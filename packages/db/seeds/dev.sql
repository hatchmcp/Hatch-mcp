-- ─────────────────────────────────────────────────────────────────────────────
-- HatchMCP dev seed — run this in Supabase SQL Editor
-- Creates a company, test projects, endpoints, MCP config, and usage data
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Company + user (replace the user UUID with your real Supabase auth.users id)
INSERT INTO companies (id, name, slug, plan, monthly_call_limit)
VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'acme-corp', 'pro', 500000)
ON CONFLICT (id) DO NOTHING;

-- Replace this UUID with your real Supabase user ID (check auth.users table)
INSERT INTO users (id, email, company_id, role)
VALUES ('22222222-2222-2222-2222-222222222222', 'gauravgjee2025@gmail.com', '11111111-1111-1111-1111-111111111111', 'owner')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Project A — deployed (Stripe-like API)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO projects (id, company_id, name, slug, source_type, source_url, base_api_url, description)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Stripe Billing API',
  'stripe-billing-api-a1b2',
  'openapi',
  'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
  'https://api.stripe.com',
  'Stripe payments and billing endpoints'
) ON CONFLICT (id) DO NOTHING;

-- Endpoints for Project A
INSERT INTO endpoints (project_id, method, path, summary, parameters, confidence, selected, llm_name, llm_description, auth_required, source_file) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/customers',               'List customers',              '[{"name":"limit","in":"query","type":"integer","required":false},{"name":"email","in":"query","type":"string","required":false}]', 'high', true, 'list_customers', 'List all customers in your Stripe account. Supports filtering by email and pagination.', true, 'customers.go:24'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/customers',               'Create customer',             '[{"name":"email","in":"body","type":"string","required":true},{"name":"name","in":"body","type":"string","required":false},{"name":"metadata","in":"body","type":"object","required":false}]', 'high', true, 'create_customer', 'Create a new customer object in Stripe. Returns the customer object on success.', true, 'customers.go:58'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/customers/{id}',          'Get customer',                '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'get_customer', 'Retrieve a customer by their Stripe ID.', true, 'customers.go:91'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/customers/{id}',          'Update customer',             '[{"name":"id","in":"path","type":"string","required":true},{"name":"email","in":"body","type":"string","required":false}]', 'high', true, 'update_customer', 'Update an existing customer. Only the provided fields are updated.', true, 'customers.go:124'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DELETE', '/v1/customers/{id}',          'Delete customer',             '[{"name":"id","in":"path","type":"string","required":true}]', 'high', false, 'delete_customer', 'Permanently delete a customer. Cannot be undone.', true, 'customers.go:157'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/charges',                 'List charges',                '[{"name":"limit","in":"query","type":"integer","required":false},{"name":"customer","in":"query","type":"string","required":false}]', 'high', true, 'list_charges', 'List all charges. Filter by customer ID.', true, 'charges.go:18'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/charges',                 'Create charge',               '[{"name":"amount","in":"body","type":"integer","required":true},{"name":"currency","in":"body","type":"string","required":true},{"name":"customer","in":"body","type":"string","required":false}]', 'high', true, 'create_charge', 'Create a new charge. Amount is in the smallest currency unit (cents).', true, 'charges.go:52'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/charges/{id}',            'Get charge',                  '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'get_charge', 'Retrieve a charge by ID.', true, 'charges.go:87'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/charges/{id}/refund',     'Refund charge',               '[{"name":"id","in":"path","type":"string","required":true},{"name":"amount","in":"body","type":"integer","required":false}]', 'high', true, 'refund_charge', 'Refund a charge. Partial refunds are supported by specifying an amount.', true, 'charges.go:118'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/payment_intents',         'List payment intents',        '[{"name":"limit","in":"query","type":"integer","required":false},{"name":"customer","in":"query","type":"string","required":false}]', 'high', true, 'list_payment_intents', 'List all payment intents.', true, 'payment_intents.go:22'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/payment_intents',         'Create payment intent',       '[{"name":"amount","in":"body","type":"integer","required":true},{"name":"currency","in":"body","type":"string","required":true},{"name":"payment_method_types","in":"body","type":"array","required":false}]', 'high', true, 'create_payment_intent', 'Create a PaymentIntent to confirm and capture payment.', true, 'payment_intents.go:61'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/payment_intents/{id}/confirm', 'Confirm payment intent', '[{"name":"id","in":"path","type":"string","required":true},{"name":"payment_method","in":"body","type":"string","required":false}]', 'high', true, 'confirm_payment_intent', 'Confirm a PaymentIntent to attempt collection of the funds.', true, 'payment_intents.go:98'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/payment_intents/{id}/cancel', 'Cancel payment intent',  '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'cancel_payment_intent', 'Cancel a PaymentIntent before it is confirmed.', true, 'payment_intents.go:134'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/subscriptions',           'List subscriptions',          '[{"name":"customer","in":"query","type":"string","required":false},{"name":"status","in":"query","type":"string","required":false}]', 'high', true, 'list_subscriptions', 'List subscriptions, optionally filtering by customer or status.', true, 'subscriptions.go:15'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/subscriptions',           'Create subscription',         '[{"name":"customer","in":"body","type":"string","required":true},{"name":"items","in":"body","type":"array","required":true}]', 'high', true, 'create_subscription', 'Create a subscription for a customer with one or more pricing plans.', true, 'subscriptions.go:48'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/subscriptions/{id}',      'Get subscription',            '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'get_subscription', 'Retrieve a subscription by ID.', true, 'subscriptions.go:82'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DELETE', '/v1/subscriptions/{id}',      'Cancel subscription',         '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'cancel_subscription', 'Cancel a subscription at period end or immediately.', true, 'subscriptions.go:115'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/invoices',                'List invoices',               '[{"name":"customer","in":"query","type":"string","required":false},{"name":"limit","in":"query","type":"integer","required":false}]', 'high', true, 'list_invoices', 'List all invoices.', true, 'invoices.go:12'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/invoices',                'Create invoice',              '[{"name":"customer","in":"body","type":"string","required":true},{"name":"description","in":"body","type":"string","required":false}]', 'medium', true, 'create_invoice', 'Create a draft invoice for a customer.', true, 'invoices.go:45'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/invoices/{id}/pay',       'Pay invoice',                 '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'pay_invoice', 'Attempt to pay an invoice outside of its normal collection schedule.', true, 'invoices.go:78'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/products',                'List products',               '[{"name":"active","in":"query","type":"boolean","required":false},{"name":"limit","in":"query","type":"integer","required":false}]', 'high', true, 'list_products', 'List all products.', true, 'products.go:10'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/products',                'Create product',              '[{"name":"name","in":"body","type":"string","required":true},{"name":"description","in":"body","type":"string","required":false}]', 'high', true, 'create_product', 'Create a new product.', true, 'products.go:38'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/prices',                  'List prices',                 '[{"name":"product","in":"query","type":"string","required":false},{"name":"active","in":"query","type":"boolean","required":false}]', 'high', true, 'list_prices', 'List all prices, optionally filtered by product.', true, 'prices.go:14'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/prices',                  'Create price',                '[{"name":"unit_amount","in":"body","type":"integer","required":true},{"name":"currency","in":"body","type":"string","required":true},{"name":"product","in":"body","type":"string","required":true}]', 'high', true, 'create_price', 'Create a new price for a product.', true, 'prices.go:47'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/balance',                 'Get balance',                 '[]', 'high', true, 'get_balance', 'Retrieve the current account balance.', true, 'balance.go:8'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/balance/history',         'List balance transactions',   '[{"name":"limit","in":"query","type":"integer","required":false},{"name":"type","in":"query","type":"string","required":false}]', 'high', true, 'list_balance_history', 'List balance transactions (charges, refunds, payouts).', true, 'balance.go:32'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/payouts',                 'List payouts',                '[{"name":"status","in":"query","type":"string","required":false},{"name":"limit","in":"query","type":"integer","required":false}]', 'medium', true, 'list_payouts', 'List all payouts to the bank account.', true, 'payouts.go:18'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'POST',   '/v1/payouts',                 'Create payout',               '[{"name":"amount","in":"body","type":"integer","required":true},{"name":"currency","in":"body","type":"string","required":true}]', 'medium', false, 'create_payout', 'Send funds to the bank account. Use with caution.', true, 'payouts.go:51'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/refunds',                 'List refunds',                '[{"name":"charge","in":"query","type":"string","required":false}]', 'high', true, 'list_refunds', 'List all refunds.', true, 'refunds.go:12'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GET',    '/v1/webhook_endpoints',       'List webhook endpoints',      '[]', 'low', false, 'list_webhooks', 'List all webhook endpoints.', true, 'webhooks.go:8')
ON CONFLICT (project_id, method, path) DO NOTHING;

-- MCP server for Project A
INSERT INTO mcp_servers (id, project_id, subdomain, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stripe-billing-api-a1b2', 'deployed')
ON CONFLICT (id) DO NOTHING;

-- MCP server version (the generated config)
INSERT INTO mcp_server_versions (id, mcp_server_id, version_number, config)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  4,
  '{"server_name":"stripe-billing-mcp","server_description":"MCP server for Stripe Billing API","auth_config":{"type":"bearer","header_name":"Authorization","header_prefix":"Bearer ","user_must_provide":["token"]},"env":{"BASE_URL":"https://api.stripe.com"},"tools":[{"name":"list_customers","description":"List all customers in your Stripe account.","input_schema":{"type":"object","properties":{"limit":{"type":"integer","description":"Max results"},"email":{"type":"string","description":"Filter by email"}},"required":[],"additionalProperties":false},"http":{"method":"GET","url_template":"${env.BASE_URL}/v1/customers","headers_template":{"Authorization":"${auth.token}"},"query_template":{"limit":"${input.limit}"},"body_template":null},"response":{"success_codes":[200],"transform":null}},{"name":"create_customer","description":"Create a new Stripe customer.","input_schema":{"type":"object","properties":{"email":{"type":"string","format":"email","description":"Customer email"},"name":{"type":"string","description":"Customer name"}},"required":["email"],"additionalProperties":false},"http":{"method":"POST","url_template":"${env.BASE_URL}/v1/customers","headers_template":{"Authorization":"${auth.token}","Content-Type":"application/x-www-form-urlencoded"},"body_template":{"email":"${input.email}","name":"${input.name}"},"query_template":null},"response":{"success_codes":[200],"transform":null}}]}'
) ON CONFLICT (id) DO NOTHING;

-- Update mcp_servers to point to the version
UPDATE mcp_servers SET current_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Deployment record
INSERT INTO deployments (id, mcp_server_id, version_id, status, deployed_at)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Project B — draft (GitHub API clone)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO projects (id, company_id, name, slug, source_type, source_url, base_api_url, description)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '11111111-1111-1111-1111-111111111111',
  'Internal API',
  'internal-api-x9y8',
  'github',
  'https://github.com/acme/api',
  'https://api.acme.internal',
  'Internal REST API for the platform team'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO endpoints (project_id, method, path, summary, parameters, confidence, selected, llm_name, llm_description, auth_required, source_file) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GET',    '/api/v1/users',              'List users',          '[{"name":"page","in":"query","type":"integer","required":false},{"name":"role","in":"query","type":"string","required":false}]', 'high', true, 'list_users', 'List all users with optional pagination and role filtering.', true, 'routes/users.ts:14'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'POST',   '/api/v1/users',              'Create user',         '[{"name":"email","in":"body","type":"string","required":true},{"name":"role","in":"body","type":"string","required":true}]', 'high', true, 'create_user', 'Create a new user account.', true, 'routes/users.ts:42'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GET',    '/api/v1/users/{id}',         'Get user',            '[{"name":"id","in":"path","type":"string","required":true}]', 'high', true, 'get_user', 'Get a single user by ID.', true, 'routes/users.ts:76'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'PATCH',  '/api/v1/users/{id}',         'Update user',         '[{"name":"id","in":"path","type":"string","required":true},{"name":"role","in":"body","type":"string","required":false}]', 'high', true, 'update_user', 'Update a user record.', true, 'routes/users.ts:108'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'DELETE', '/api/v1/users/{id}',         'Delete user',         '[{"name":"id","in":"path","type":"string","required":true}]', 'high', false, 'delete_user', 'Permanently delete a user.', true, 'routes/users.ts:140'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GET',    '/api/v1/orgs',               'List orgs',           '[]', 'high', true, 'list_orgs', 'List all organizations.', true, 'routes/orgs.ts:8'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'POST',   '/api/v1/orgs',               'Create org',          '[{"name":"name","in":"body","type":"string","required":true},{"name":"slug","in":"body","type":"string","required":true}]', 'high', true, 'create_org', 'Create a new organization.', true, 'routes/orgs.ts:35'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GET',    '/api/v1/orgs/{id}/members',  'List org members',    '[{"name":"id","in":"path","type":"string","required":true}]', 'medium', true, 'list_org_members', 'List all members of an organization.', true, 'routes/orgs.ts:68'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'POST',   '/api/v1/orgs/{id}/members',  'Add org member',      '[{"name":"id","in":"path","type":"string","required":true},{"name":"user_id","in":"body","type":"string","required":true}]', 'medium', true, 'add_org_member', 'Add a user to an organization.', true, 'routes/orgs.ts:95'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GET',    '/api/v1/audit-log',          'List audit events',   '[{"name":"actor","in":"query","type":"string","required":false},{"name":"limit","in":"query","type":"integer","required":false}]', 'low', false, 'list_audit_log', 'List all audit log events. Possibly missed — low confidence.', true, 'routes/audit.ts:12')
ON CONFLICT (project_id, method, path) DO NOTHING;

INSERT INTO mcp_servers (id, project_id, subdomain, status)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'internal-api-x9y8', 'draft')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Usage data for analytics
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO usage_events (mcp_server_id, deployment_id, tool_name, status_code, latency_ms, created_at)
SELECT
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  tool,
  CASE WHEN random() < 0.05 THEN 500 WHEN random() < 0.02 THEN 429 ELSE 200 END,
  (50 + random() * 400)::int,
  now() - (random() * interval '7 days')
FROM (
  SELECT unnest(ARRAY[
    'list_customers','list_customers','list_customers','list_customers',
    'create_customer','create_customer',
    'get_customer','get_customer','get_customer',
    'create_charge','create_charge','create_charge',
    'list_charges','list_charges',
    'create_payment_intent','create_payment_intent','create_payment_intent','create_payment_intent',
    'confirm_payment_intent','confirm_payment_intent','confirm_payment_intent',
    'list_subscriptions','list_subscriptions',
    'create_subscription',
    'pay_invoice',
    'get_balance','get_balance','get_balance',
    'list_invoices'
  ]) as tool
) t, generate_series(1, 8) -- 8 × 29 = ~232 events
ON CONFLICT DO NOTHING;

-- Hourly rollups
INSERT INTO usage_rollups_hourly (mcp_server_id, hour, total_calls, error_calls, p95_latency_ms)
SELECT
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  date_trunc('hour', now()) - (n || ' hours')::interval,
  (30 + random() * 120)::int,
  (random() * 5)::int,
  (180 + random() * 200)::int
FROM generate_series(0, 167) n  -- 7 days of hours
ON CONFLICT (mcp_server_id, hour) DO UPDATE
  SET total_calls = EXCLUDED.total_calls,
      error_calls = EXCLUDED.error_calls,
      p95_latency_ms = EXCLUDED.p95_latency_ms;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. A few job records to show on the jobs list
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO jobs (project_id, type, status, progress, result, started_at, finished_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ingest',   'succeeded', 100, '{"endpoint_count":30}', now()-interval '3 hours', now()-interval '2 hours 55 min'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'generate', 'succeeded', 100, '{"tool_count":28}',     now()-interval '2 hours 50 min', now()-interval '2 hours 42 min'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test',     'succeeded', 100, '{"passed":true}',       now()-interval '2 hours 40 min', now()-interval '2 hours 38 min'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'deploy',   'succeeded', 100, '{"version":4}',         now()-interval '2 hours 37 min', now()-interval '2 hours 36 min'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ingest',   'succeeded', 100, '{"endpoint_count":10}', now()-interval '1 hour', now()-interval '55 min')
ON CONFLICT DO NOTHING;

-- Done! Visit http://localhost:3000 to see the seeded data.
-- Note: update the user UUID in step 1 to match your real Supabase auth.users.id
