# Node-Edge Connection Issue Analysis

## Current Status
- **Displayed**: 12 Models, 39 Relations (shown in UI)
- **API Returns**: 26 Nodes, 110 Relationships
- **Edges Rendered**: 0 (No connections visible)

## Root Cause Analysis

### Issue 1: Only 12 of 26 Nodes Are Displayed

The frontend is only showing 12 nodes when the API returns 26. This appears to be using demo data or partial data.

**Evidence from DOM inspection:**
- Node IDs in DOM: `9f17585d-d186-4310-8aba-841ac54a705f` (generated UUIDs)
- Node IDs from API: `dfeca27b-6873-495c-a873-a880600d51ba` (different UUIDs)

### Issue 2: Edge Creation Fails Due to Node ID Mismatch

**The Core Problem:**

1. **Backend relationships** reference models by **NAME**:
   ```json
   {
     "source_model": "CircuitTerminationType",  // NAME
     "target_model": "CableType"                // NAME
   }
   ```

2. **Backend nodes** have **UUID IDs**:
   ```json
   {
     "id": "dfeca27b-6873-495c-a873-a880600d51ba",
     "name": "CircuitTerminationType"
   }
   ```

3. **Frontend transformation** (frontend/src/utils/schemaTransformer.ts):
   - Line 336-357: Correctly maps `source_model` → `fromModel` and `target_model` → `toModel`
   - Line 189-194: Tries to find node IDs by matching names
   - Line 193-194: Uses found node IDs for edge source/target

4. **Edge validation** (Line 222-241):
   - Creates a Set of node IDs (UUIDs)
   - Validates that edge.source and edge.target exist in this Set
   - **FAILS** if nodes are missing or IDs don't match

## Detailed Code Flow

### 1. API Response Processing (frontend/src/utils/schemaTransformer.ts:247-363)

```typescript
// Line 270-283: Response structure detection
if (response.nodes && Array.isArray(response.nodes)) {
  actualResponse = response;
} else if ((response as any).schema_graph) {
  actualResponse = (response as any).schema_graph;  // ✓ Correctly uses schema_graph
}

// Line 304-329: Node transformation
const nodes: Node<NautobotNodeData>[] = actualResponse.nodes.map((node, index) => {
  const frontendNode: ModelNode = {
    ...node,
    app: nodeApp,  // Maps app_label → app
    fields: node.fields || [],
    relationships: node.relationships || { outgoing: [], incoming: [] },
    isAbstract: (node as any).is_abstract ?? node.isAbstract ?? false,
  };
  return transformModelToNode(frontendNode, index, positions[index]);
});
```

### 2. Edge Creation (Line 336-351)

```typescript
if (actualResponse.relationships && Array.isArray(actualResponse.relationships)) {
  edges = actualResponse.relationships.map(relationship => {
    // Snake_case to camelCase conversion
    const frontendRelationship: ModelRelationship = {
      id: relationship.id,
      fromModel: relationship.source_model,  // "CircuitTerminationType"
      toModel: relationship.target_model,    // "CableType"
      type: relationship.relationship_type,
      fieldName: relationship.field_name,
      relatedName: relationship.related_name,
    };

    return transformRelationshipToEdge(frontendRelationship, actualResponse.nodes);
  });
}
```

### 3. Edge ID Resolution (Line 189-194)

```typescript
// Find actual node IDs from model names
const sourceNodeId = sourceNodes.find(node =>
  node.name === relationship.fromModel  // Finds node by name
)?.id || relationship.fromModel;        // Falls back to name if not found

const targetNodeId = sourceNodes.find(node =>
  node.name === relationship.toModel    // Finds node by name
)?.id || relationship.toModel;          // Falls back to name if not found
```

### 4. Edge Validation (Line 226-240)

```typescript
const nodeIds = new Set(nodes.map(node => node.id));  // Set of UUIDs

return edges.filter(edge => {
  const hasValidSource = nodeIds.has(edge.source);  // Check if source UUID exists
  const hasValidTarget = nodeIds.has(edge.target);  // Check if target UUID exists

  if (!hasValidSource || !hasValidTarget) {
    console.warn(`Skipping edge ${edge.id}: missing node(s).`);
    return false;  // Edge is filtered out!
  }
  return true;
});
```

## The Missing Link

The issue is that **not all 26 nodes are being rendered**, only 12 are shown. This means:

1. When relationships reference nodes like "CableType", "CablePathType", etc.
2. These nodes might not be in the displayed 12 nodes
3. The edge validation fails because the target node IDs don't exist
4. All edges referencing missing nodes are filtered out
5. Result: 0 edges displayed

## Proof from Data Files

### From backend/data/sample_relationships.json:
- Relationship references: "CableType", "ContentTypeType", "CablePathType", "LocationType"
- These are valid nodes in the API response

### From backend/data/node_id_mapping.json:
- Only shows first 10 nodes, but includes: "CircuitTerminationType", "TagType", "ContentTypeType", "LocationType"
- Missing: "CableType", "CablePathType" (not in first 10 but exist in full response)

## Solution Required

1. **Ensure all 26 nodes are loaded and transformed** from the API response
2. **Verify the node finding logic** in transformRelationshipToEdge works correctly
3. **Add detailed logging** to see which edges are being filtered and why
4. **Check if demo mode is accidentally active** instead of live API mode

## Files to Check/Modify

1. **frontend/src/hooks/useSchemaVisualization.ts:166-180**
   - Verify connectionMode is 'live' not 'demo'
   - Ensure schemaResponse contains all 26 nodes

2. **frontend/src/utils/schemaTransformer.ts:304-329**
   - Verify all nodes are being transformed
   - Add logging to show how many nodes are processed

3. **frontend/src/utils/schemaTransformer.ts:336-351**
   - Add logging to show relationship processing
   - Verify edge creation for each relationship

4. **frontend/src/utils/schemaTransformer.ts:226-240**
   - Add detailed logging about which edges fail validation
   - Show which node IDs are missing