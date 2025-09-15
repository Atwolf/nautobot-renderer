# Edge Connection Analysis

## Problem
Nodes are displayed but not connected by edges despite having 110 relationships in the API response.

## Data Flow Analysis

### 1. Backend API Response (backend/data/api_v1_schema_discover.json)
- **Structure**: `{ schema_graph: { nodes: [...], relationships: [...] } }`
- **Total Nodes**: 26
- **Total Relationships**: 110
- **Node IDs**: UUIDs like `"dfeca27b-6873-495c-a873-a880600d51ba"`
- **Node Names**: Like `"CircuitTerminationType"`

### 2. Sample Relationship Structure (backend/data/sample_relationships.json)
```json
{
  "id": "85b4ada9-eb9f-47b0-9add-7e4b8c29dbd6",
  "source_model": "CircuitTerminationType",  // Model NAME not ID
  "target_model": "CableType",               // Model NAME not ID
  "relationship_type": "foreign_key",
  "field_name": "cable",
  "related_name": "circuitterminationtypes",
  "through_model": null,
  "is_nullable": true,
  "description": null
}
```

## Critical Issue Identified

The relationships use **model names** (`"CircuitTerminationType"`, `"CableType"`) but nodes are identified by **UUIDs** (`"dfeca27b-6873-495c-a873-a880600d51ba"`).

### Edge Creation Logic (frontend/src/utils/schemaTransformer.ts)

#### Line 336-357: Relationship Transformation
```typescript
// Transform relationships (backend calls them 'relationships', not 'edges')
let edges: Edge<NautobotEdgeData>[] = [];
if (actualResponse.relationships && Array.isArray(actualResponse.relationships)) {
  edges = actualResponse.relationships
    .map(relationship => {
      // Convert snake_case backend properties to camelCase frontend format
      const frontendRelationship: ModelRelationship = {
        id: relationship.id,
        fromModel: relationship.source_model,  // This is NAME not ID!
        toModel: relationship.target_model,    // This is NAME not ID!
        type: relationship.relationship_type,
        fieldName: relationship.field_name,
        relatedName: relationship.related_name,
        ...
      };
```

#### Line 181-217: Edge Creation
```typescript
function transformRelationshipToEdge(
  relationship: ModelRelationship,
  sourceNodes: ModelNode[]
): Edge<NautobotEdgeData> {
  // Find source node to determine if relationship is required
  const sourceNode = sourceNodes.find(node =>
    node.name === relationship.fromModel ||  // Comparing NAME to NAME ✓
    node.id === relationship.fromModel       // Comparing ID to NAME ✗
  );

  // For edge source/target, use node IDs instead of model names
  const sourceNodeId = sourceNodes.find(node =>
    node.name === relationship.fromModel  // This will find the node!
  )?.id || relationship.fromModel;

  const targetNodeId = sourceNodes.find(node =>
    node.name === relationship.toModel    // This will find the node!
  )?.id || relationship.toModel;

  return {
    id: relationship.id,
    source: sourceNodeId,  // Should be UUID
    target: targetNodeId,  // Should be UUID
    ...
  };
}
```

#### Line 222-241: Edge Validation
```typescript
function validateEdgeReferences(
  edges: Edge<NautobotEdgeData>[],
  nodeIds: Set<string>  // Set of UUIDs
): Edge<NautobotEdgeData>[] {
  return edges.filter(edge => {
    const hasValidSource = nodeIds.has(edge.source);  // Checking if UUID exists
    const hasValidTarget = nodeIds.has(edge.target);  // Checking if UUID exists

    if (!hasValidSource || !hasValidTarget) {
      console.warn(
        `Skipping edge ${edge.id}: missing node(s). ` +
        `Source: ${edge.source} (exists: ${hasValidSource}), ` +
        `Target: ${edge.target} (exists: ${hasValidTarget})`
      );
      return false;
    }

    return true;
  });
}
```

## The Problem Chain

1. **Relationships reference model names**: `"CircuitTerminationType"`, `"CableType"`
2. **Nodes are stored with UUIDs**: `"dfeca27b-6873-495c-a873-a880600d51ba"`
3. **Edge creation finds nodes correctly** by matching names
4. **But some nodes might be missing** - we have only 12 nodes displayed but 26 in API response
5. **Missing nodes cause edge validation to fail** - edges referencing missing nodes are filtered out

## Why Only 12 Nodes Show Instead of 26?

The frontend shows "12 Models" but the API returns 26 nodes. This suggests:
1. Some nodes are being filtered out during transformation
2. Relationships to missing nodes are then invalid

## Files Involved

### Backend
- `backend/app/models/schema.py:98-162` - Relationship model definition
- `backend/app/models/schema.py:55-97` - ModelNode model definition
- `backend/app/api/v1/endpoints/schema.py:29-98` - API endpoint
- `backend/app/services/schema_transformer.py:170-198` - Relationship transformation

### Frontend
- `frontend/src/utils/schemaTransformer.ts:336-357` - Relationship array processing
- `frontend/src/utils/schemaTransformer.ts:181-217` - Edge creation from relationships
- `frontend/src/utils/schemaTransformer.ts:222-241` - Edge validation
- `frontend/src/types/schema.ts:21-36` - ModelRelationship interface

## Next Steps

1. Check why only 12 of 26 nodes are being displayed
2. Verify that all required nodes (CableType, CablePathType, etc.) exist in the nodes array
3. Add logging to see which edges are being filtered out in validation