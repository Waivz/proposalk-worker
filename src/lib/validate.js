// src/lib/validate.js
// ─────────────────────────────────────────────────────────
// V2: Supports both single-scenario (V1) and multi-scenario (V2) payloads.
// normalizePayload() runs BEFORE validation, shimming V1 → V2 in-place.
// ─────────────────────────────────────────────────────────

/**
 * Normalize a V1 (single scenario) payload into V2 (scenarios array) in-place.
 * Safe to call on already-V2 payloads — no-ops if scenarios[] exists.
 *
 * Mutations:
 *   - payload.scenario  → payload.scenarios[0]  (with label "Option 1")
 *   - participant.allocations (object) → [object]
 *   - fees (flat) → { per_scenario: [extracted], ...shared }
 */
export function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  // ── Scenario shim ──
  if (payload.scenario && !payload.scenarios) {
    const s = payload.scenario;
    payload.scenarios = [Object.assign({ label: 'Option 1' }, s)];
    delete payload.scenario;
  }

  // ── Participant allocations shim ──
  if (Array.isArray(payload.participants)) {
    for (const p of payload.participants) {
      if (p && p.allocations && !Array.isArray(p.allocations)) {
        p.allocations = [p.allocations];
      }
    }
  }

  // ── Fees shim ──
  if (payload.fees && !payload.fees.per_scenario) {
    const f = payload.fees;
    payload.fees = {
      per_scenario: [{
        one_time_design: f.one_time_design,
        participant_fee: f.participant_fee,
        cross_testing: f.cross_testing,
        annual_total: f.annual_total
      }],
      annual_base: f.annual_base,
      fiduciary_316: f.fiduciary_316,
      billing_frequency: f.billing_frequency
    };
  }

  return payload;
}

/**
 * Validate a NORMALIZED (V2) payload. Call normalizePayload() first.
 * Returns { ok: true } or { ok: false, message, errors: string[] }.
 */
export function validatePayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      message: 'Payload must be a JSON object at the root',
      errors: ['root must be an object']
    };
  }

  // ── Required top-level blocks ──
  const requiredBlocks = ['sponsor', 'scenarios', 'fees', 'participants'];
  for (const b of requiredBlocks) {
    if (payload[b] === undefined || payload[b] === null) {
      // Friendly hint if they sent old-style "scenario" without normalizing
      if (b === 'scenarios' && payload.scenario) {
        errors.push('missing required block: scenarios (found "scenario" — did normalizePayload() run?)');
      } else {
        errors.push(`missing required block: ${b}`);
      }
    }
  }

  // ── Scenarios validation ──
  if (payload.scenarios !== undefined) {
    if (!Array.isArray(payload.scenarios)) {
      errors.push('scenarios must be an array');
    } else if (payload.scenarios.length === 0) {
      errors.push('scenarios array is empty');
    } else if (payload.scenarios.length > 3) {
      errors.push(`scenarios array has ${payload.scenarios.length} entries (max 3)`);
    } else {
      payload.scenarios.forEach((s, i) => {
        if (!s || typeof s !== 'object') {
          errors.push(`scenarios[${i}] must be an object`);
          return;
        }
        if (!s.plan_type) errors.push(`scenarios[${i}].plan_type is missing`);
        if (s.owner_contribution_total !== undefined && typeof s.owner_contribution_total !== 'number') {
          errors.push(`scenarios[${i}].owner_contribution_total must be a number`);
        }
        if (s.nonowner_er_contribution_total !== undefined && typeof s.nonowner_er_contribution_total !== 'number') {
          errors.push(`scenarios[${i}].nonowner_er_contribution_total must be a number`);
        }
        if (s.tax_savings_total !== undefined && typeof s.tax_savings_total !== 'number') {
          errors.push(`scenarios[${i}].tax_savings_total must be a number`);
        }
      });
    }
  }

  // ── Participants validation ──
  const scenarioCount = Array.isArray(payload.scenarios) ? payload.scenarios.length : 0;

  if (payload.participants !== undefined) {
    if (!Array.isArray(payload.participants)) {
      errors.push('participants must be an array');
    } else if (payload.participants.length === 0) {
      errors.push('participants array is empty');
    } else {
      const owners = payload.participants.filter(p => p && p.is_owner === true);
      if (owners.length === 0) {
        errors.push('participants array contains no row with is_owner=true');
      }

      const p0 = payload.participants[0];
      if (p0 && typeof p0 === 'object') {
        if (!p0.name) errors.push('participants[0].name is missing');
        if (typeof p0.plan_comp !== 'number') errors.push('participants[0].plan_comp must be a number');
        if (!p0.allocations) {
          errors.push('participants[0].allocations block is missing');
        } else if (Array.isArray(p0.allocations)) {
          // V2: allocations array length must match scenarios count
          if (scenarioCount > 0 && p0.allocations.length !== scenarioCount) {
            errors.push(
              `participants[0].allocations has ${p0.allocations.length} entries but scenarios has ${scenarioCount} — these must match`
            );
          }
        }
      }
    }
  }

  // ── Fees validation ──
  if (payload.fees && payload.fees.per_scenario) {
    if (!Array.isArray(payload.fees.per_scenario)) {
      errors.push('fees.per_scenario must be an array');
    } else if (scenarioCount > 0 && payload.fees.per_scenario.length !== scenarioCount) {
      errors.push(
        `fees.per_scenario has ${payload.fees.per_scenario.length} entries but scenarios has ${scenarioCount} — these must match`
      );
    }
  }

  // ── Vendor validation ──
  if (payload.vendor !== undefined && typeof payload.vendor !== 'string') {
    errors.push('vendor must be a string if provided (will default to "cetera")');
  }

  if (errors.length) {
    return {
      ok: false,
      message: `Payload validation failed: ${errors.length} issue(s)`,
      errors
    };
  }
  return { ok: true };
}
