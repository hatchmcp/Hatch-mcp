import { pool, queryOne } from '../../lib/db.js'
import { burstConfigCache } from './cache-bust.js'
import { logger } from '../../lib/logger.js'
import type { McpConfig } from '@hatchmcp/shared'

export interface DeployResult {
  deploymentId: string
  versionId: string
  versionNumber: number
  subdomain: string
}

export async function deployConfig(opts: {
  mcpServerId: string
  subdomain: string
  config: McpConfig
  deployedBy: string
}): Promise<DeployResult> {
  const { mcpServerId, subdomain, config, deployedBy } = opts
  const log = logger.child({ mcpServerId, subdomain })

  // Determine next version number
  const lastVersion = await queryOne<{ version_number: number }>(
    `SELECT version_number FROM mcp_server_versions
     WHERE mcp_server_id = $1
     ORDER BY version_number DESC LIMIT 1`,
    [mcpServerId]
  )
  const versionNumber = (lastVersion?.version_number ?? 0) + 1

  log.info('Deploying version', { versionNumber })

  // Atomic deploy: insert new version, mark old deployments rolled_back,
  // promote new deployment to active, and update mcp_servers.current_version_id
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [version] } = await client.query<{ id: string }>(
      `INSERT INTO mcp_server_versions (mcp_server_id, version_number, config)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [mcpServerId, versionNumber, JSON.stringify(config)]
    )

    const { rows: [deployment] } = await client.query<{ id: string }>(
      `INSERT INTO deployments (mcp_server_id, version_id, status, deployed_by)
       VALUES ($1, $2, 'active', $3)
       RETURNING id`,
      [mcpServerId, version.id, deployedBy]
    )

    await client.query(
      `UPDATE deployments
       SET status = 'rolled_back', rolled_back_at = now()
       WHERE mcp_server_id = $1
         AND status = 'active'
         AND id != $2`,
      [mcpServerId, deployment.id]
    )

    await client.query(
      `UPDATE mcp_servers
       SET current_version_id = $1, status = 'deployed', updated_at = now()
       WHERE id = $2`,
      [version.id, mcpServerId]
    )

    await client.query('COMMIT')

    // Invalidate runtime cache after successful DB commit
    await burstConfigCache(subdomain)

    log.info('Deploy succeeded', { deploymentId: deployment.id, versionNumber })

    return {
      deploymentId: deployment.id,
      versionId: version.id,
      versionNumber,
      subdomain,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function rollbackDeployment(opts: {
  mcpServerId: string
  subdomain: string
}): Promise<DeployResult> {
  const { mcpServerId, subdomain } = opts

  // Find the most recent rolled_back version to restore
  const previous = await queryOne<{ version_id: string; id: string; version_number: number }>(
    `SELECT d.id, d.version_id, v.version_number
     FROM deployments d
     JOIN mcp_server_versions v ON v.id = d.version_id
     WHERE d.mcp_server_id = $1 AND d.status = 'rolled_back'
     ORDER BY d.deployed_at DESC LIMIT 1`,
    [mcpServerId]
  )

  if (!previous) throw new Error('No previous version to roll back to')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [deployment] } = await client.query<{ id: string }>(
      `INSERT INTO deployments (mcp_server_id, version_id, status)
       VALUES ($1, $2, 'active')
       RETURNING id`,
      [mcpServerId, previous.version_id]
    )

    await client.query(
      `UPDATE deployments
       SET status = 'rolled_back', rolled_back_at = now()
       WHERE mcp_server_id = $1 AND status = 'active' AND id != $2`,
      [mcpServerId, deployment.id]
    )

    await client.query(
      `UPDATE mcp_servers SET current_version_id = $1, updated_at = now() WHERE id = $2`,
      [previous.version_id, mcpServerId]
    )

    await client.query('COMMIT')
    await burstConfigCache(subdomain)

    return {
      deploymentId: deployment.id,
      versionId: previous.version_id,
      versionNumber: previous.version_number,
      subdomain,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
