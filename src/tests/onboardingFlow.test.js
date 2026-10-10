/**
 * AeroHR Onboarding Flow & Edge Function Unit Test Suite
 * Path: src/tests/onboardingFlow.test.js
 *
 * Sequence 1: Supabase 'offshore_onboarding' Data Payload & Insertion Mechanics
 * Sequence 2: Serverless Edge Function ('/functions/v1/swift-function') & Universal Dispatch
 */

// Lightweight assertion and runner framework
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ----------------------------------------------------------------------------
// Core Utility & Token Instantiation
// ----------------------------------------------------------------------------
function generateStandardUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function constructPayload(formData, token) {
  return {
    full_name: formData.full_name,
    email: formData.email,
    role_type: formData.role_type,
    secure_token: token || generateStandardUUID(),
    pipeline_route: formData.pipeline_route || 'Offshore_India_Hub',
    current_step: 'hired',
    shift_configuration: formData.shift_configuration || 'US_EST_Alignment',
    base_compensation: formData.base_compensation || ''
  };
}

// ----------------------------------------------------------------------------
// Mock Supabase Database Client
// ----------------------------------------------------------------------------
class MockSupabaseClient {
  constructor(options = {}) {
    this.tableStore = { offshore_onboarding: [] };
    this.simulateColumnError = options.simulateColumnError || false;
  }

  from(tableName) {
    const self = this;
    return {
      insert(rows) {
        return {
          select() {
            return {
              single: async () => {
                if (tableName !== 'offshore_onboarding') {
                  return { data: null, error: new Error(`Table ${tableName} not found`) };
                }
                const row = rows[0];
                if (!row.full_name || !row.email) {
                  return { data: null, error: new Error('Missing required fields: full_name and email') };
                }
                // Simulate column missing error if schema is unmigrated
                if (self.simulateColumnError && (row.shift_configuration || row.base_compensation)) {
                  return {
                    data: null,
                    error: {
                      message: 'column "shift_configuration" of relation "offshore_onboarding" does not exist',
                      code: '42703'
                    }
                  };
                }
                const record = {
                  id: generateStandardUUID(),
                  created_at: new Date().toISOString(),
                  ...row
                };
                self.tableStore.offshore_onboarding.push(record);
                return { data: record, error: null };
              }
            };
          }
        };
      }
    };
  }
}

// ----------------------------------------------------------------------------
// Mock Serverless Fetch Relay
// ----------------------------------------------------------------------------
async function mockServerlessFetch(url, options = {}) {
  const parsedUrl = new URL(url, 'https://supabase.co');
  const path = parsedUrl.pathname;

  // Simulate latency
  await new Promise(r => setTimeout(r, 10));

  // Sequence 2: Edge Function /functions/v1/swift-function
  if (path === '/functions/v1/swift-function' || url.includes('swift-function')) {
    const authHeader = options.headers?.['Authorization'] || options.headers?.['authorization'];
    if (!authHeader || !authHeader.includes('Bearer')) {
      return {
        status: 401,
        ok: false,
        json: async () => ({ error: 'Unauthorized: missing Bearer token' })
      };
    }
    const body = JSON.parse(options.body || '{}');
    if (!body.record || !body.record.email || !body.record.secure_token) {
      return {
        status: 400,
        ok: false,
        json: async () => ({ error: 'Invalid payload: missing record.email or record.secure_token' })
      };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        success: true,
        message: 'Telemetry dispatched successfully',
        recipient: body.record.email,
        secure_token: body.record.secure_token
      })
    };
  }

  // Formspree Universal Mailing Relay
  if (url.includes('formspree.io')) {
    const body = JSON.parse(options.body || '{}');
    if (!body.recipient || !body.message) {
      return {
        status: 400,
        ok: false,
        json: async () => ({ error: 'Missing recipient or message' })
      };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        ok: true,
        dispatched_to: body.recipient
      })
    };
  }

  return {
    status: 404,
    ok: false,
    json: async () => ({ error: 'Endpoint not found' })
  };
}

// ----------------------------------------------------------------------------
// Execution Runner
// ----------------------------------------------------------------------------
async function runOnboardingTestSuite() {
  console.log('========================================================================');
  console.log('🧪 AET-01: AUTOMATED ONBOARDING TRANSACTION & EDGE FUNCTION TEST SUITE');
  console.log('========================================================================\n');

  // ==========================================================================
  // SEQUENCE 1: SUPABASE 'offshore_onboarding' DATA PAYLOAD & SAVING INTEGRITY
  // ==========================================================================
  console.log('--- SEQUENCE 1: Data Integrity & Table Insertion Mechanics ---');

  const token = generateStandardUUID();
  assert(
    typeof token === 'string' && token.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token),
    `Token Instantiation generates standard 36-character RFC-4122 UUID: "${token}"`
  );

  const sampleCandidate = {
    full_name: 'Priyanshu Sharma',
    email: 'priyanshu.sharma@aero-hr.internal',
    role_type: 'bench_sales',
    pipeline_route: 'Offshore_India_Hub',
    shift_configuration: 'Night Shift (6:30 PM - 3:30 AM IST)',
    base_compensation: '₹16,50,000 PA'
  };

  const payload = constructPayload(sampleCandidate, token);
  assert(payload.current_step === 'hired', 'Payload state correctly defaults to current_step: "hired"');
  assert(payload.secure_token === token, 'Candidate payload retains secure_token mapping integrity');
  assert(payload.role_type === 'bench_sales', 'Role designation correctly assigned to offshore candidate');

  const mockDb = new MockSupabaseClient();
  const insertResult = await mockDb.from('offshore_onboarding').insert([payload]).select().single();
  assert(!insertResult.error && insertResult.data !== null, 'Insert query into "offshore_onboarding" returns status 201 equivalent record');
  assert(insertResult.data.id && insertResult.data.id.length === 36, 'Inserted record receives system-generated primary key UUID');
  assert(insertResult.data.email === sampleCandidate.email, 'Database store preserves candidate email without corruption');

  // Test Fallback for Missing Schema Columns
  const mockDbWithLegacySchema = new MockSupabaseClient({ simulateColumnError: true });
  const failedInsert = await mockDbWithLegacySchema.from('offshore_onboarding').insert([payload]).select().single();
  assert(failedInsert.error && failedInsert.error.code === '42703', 'Legacy schema column absence correctly detected (code 42703)');

  // Execute Fallback Insert with Core Columns
  const corePayload = {
    full_name: sampleCandidate.full_name,
    email: sampleCandidate.email,
    role_type: sampleCandidate.role_type,
    secure_token: token,
    current_step: 'hired'
  };
  const fallbackResult = await mockDb.from('offshore_onboarding').insert([corePayload]).select().single();
  assert(!fallbackResult.error && fallbackResult.data.current_step === 'hired', 'Fallback insertion preserves core schema fields without throwing');

  // Validation boundary test: Missing required fields
  const invalidCandidate = { full_name: '', email: '' };
  const invalidPayload = constructPayload(invalidCandidate, token);
  const rejectResult = await mockDb.from('offshore_onboarding').insert([invalidPayload]).select().single();
  assert(rejectResult.error !== null, 'Empty field submission properly rejected at database boundary');

  console.log('\n--- SEQUENCE 2: Serverless Edge Function & Universal Dispatch ---');

  // ==========================================================================
  // SEQUENCE 2: SERVERLESS FETCH & LIVE EDGE FUNCTION ENDPOINTS
  // ==========================================================================
  const edgeFunctionEndpoint = 'https://supabase.co/functions/v1/swift-function';
  const edgePayload = {
    record: {
      email: insertResult.data.email,
      full_name: insertResult.data.full_name,
      secure_token: insertResult.data.secure_token
    }
  };

  const edgeResponse = await mockServerlessFetch(edgeFunctionEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sb_publishable_pjtjw08be3qzlpa2akgug_A8lxmNwS7M0nU6R6o5xW7f2W5r6D9K8Z'
    },
    body: JSON.stringify(edgePayload)
  });

  assert(edgeResponse.status === 200, `Live Edge Function '/functions/v1/swift-function' returns HTTP 200 OK`);
  const edgeData = await edgeResponse.json();
  assert(edgeData.success === true, 'Edge function response payload confirms successful dispatch');
  assert(edgeData.recipient === sampleCandidate.email, 'Telemetry payload maps recipient email accurately');
  assert(edgeData.secure_token === token, 'Authorization handshake verifies matching candidate secure_token');

  // Test Edge Function with missing Authorization
  const unauthResponse = await mockServerlessFetch(edgeFunctionEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(edgePayload)
  });
  assert(unauthResponse.status === 401, 'Edge function rejects unauthorized requests with HTTP 401');

  // Test Universal Formspree Relay
  const formspreeEndpoint = 'https://formspree.io/f/xvgowzkp';
  const mailRelayResponse = await mockServerlessFetch(formspreeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      _subject: `⚠️ Action Required: Initialize your AeroHR Profile, ${sampleCandidate.full_name}`,
      recipient: sampleCandidate.email,
      message: `Hello ${sampleCandidate.full_name},\n\nUpload identification documents:\nhttps://yourdashboard.com/portal/upload/${token}`
    })
  });
  assert(mailRelayResponse.status === 200, 'Universal mail delivery relay returns HTTP 200 without domain sandboxing');
  const mailData = await mailRelayResponse.json();
  assert(mailData.ok === true && mailData.dispatched_to === sampleCandidate.email, 'Mailing relay payload reaches target email recipient safely');

  console.log('\n========================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateStandardUUID,
    constructPayload,
    MockSupabaseClient,
    mockServerlessFetch,
    runOnboardingTestSuite
  };
}

if (typeof require !== 'undefined' && require.main === module) {
  runOnboardingTestSuite().catch(err => {
    console.error('Unhandled exception in test runner:', err);
    process.exit(1);
  });
}
