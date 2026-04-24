// =============================================================================
// validatePayload — lightweight pre-flight checks
// =============================================================================
// This is NOT a full JSON Schema validator — we don't want to pull in ajv just
// to catch a missing field. It's a fail-fast sanity check for the fields most
// likely to break the render if absent, and the errors it emits are written
// for humans debugging an upstream adapter, not for machines.
//
// If validation concerns get more complex (field cross-consistency, enum
// membership, date-range rules), promote this to a proper schema validator
// driven by src/schema.json.
// =============================================================================

export function validatePayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      message: 'Payload must be a JSON object at the root',
      errors: ['root must be an object']
    };
  }

  // --- Required top-level blocks ---------------------------------------
  const requiredBlocks = ['sponsor', 'scenario', 'fees', 'participants'];
  for (const b of requiredBlocks) {
    if (payload[b] === undefined || payload[b] === null) {
      errors.push(`missing required block: ${b}`);
    }
  }

  // --- Participants structure ------------------------------------------
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
      // Spot-check first participant for required fields
      const p0 = payload.participants[0];
      if (p0 && typeof p0 === 'object') {
        if (!p0.name) errors.push('participants[0].name is missing');
        if (typeof p0.plan_comp !== 'number') errors.push('participants[0].plan_comp must be a number');
        if (!p0.allocations) errors.push('participants[0].allocations block is missing');
      }
    }
  }

  // --- Scenario totals must be numeric --------------------------------
  if (payload.scenario && typeof payload.scenario === 'object') {
    const s = payload.scenario;
    if (!s.plan_type) errors.push('scenario.plan_type is missing');
    if (s.owner_contribution_total !== undefined && typeof s.owner_contribution_total !== 'number') {
      errors.push('scenario.owner_contribution_total must be a number');
    }
    if (s.nonowner_er_contribution_total !== undefined && typeof s.nonowner_er_contribution_total !== 'number') {
      errors.push('scenario.nonowner_er_contribution_total must be a number');
    }
    if (s.tax_savings_total !== undefined && typeof s.tax_savings_total !== 'number') {
      errors.push('scenario.tax_savings_total must be a number');
    }
  }

  // --- Vendor check ---------------------------------------------------
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
