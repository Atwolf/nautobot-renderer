"""Schema data models for Nautobot discovery and visualization."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class RelationshipType(str, Enum):
    """Enumeration of possible relationship types between models."""

    FOREIGN_KEY = "foreign_key"
    MANY_TO_MANY = "many_to_many"
    ONE_TO_ONE = "one_to_one"
    CUSTOM_RELATIONSHIP = "custom_relationship"


class FieldInfo(BaseModel):
    """Information about a field in a Nautobot model."""

    name: str = Field(..., description="Field name", min_length=1)
    field_type: str = Field(..., description="Django/GraphQL field type", min_length=1)
    is_nullable: bool = Field(default=True, description="Whether field can be null")
    is_list: bool = Field(default=False, description="Whether field is a list type")
    description: Optional[str] = Field(
        None, description="Field description from schema"
    )
    default_value: Optional[Any] = Field(None, description="Default value if any")
    max_length: Optional[int] = Field(
        None, description="Maximum length for string fields"
    )
    choices: Optional[List[str]] = Field(
        None, description="Valid choices for choice fields"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        """Validate field name is non-empty and valid identifier."""
        if not v or not v.strip():
            raise ValueError("Field name cannot be empty")
        return v.strip()

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v):
        """Validate field type is non-empty."""
        if not v or not v.strip():
            raise ValueError("Field type cannot be empty")
        return v.strip()


class ModelNode(BaseModel):
    """Represents a Nautobot model with its fields and metadata."""

    id: str = Field(
        default_factory=lambda: str(uuid4()), description="Unique identifier"
    )
    name: str = Field(..., description="Model name", min_length=1)
    app_label: str = Field(
        ..., description="Django app containing this model", min_length=1
    )
    table_name: Optional[str] = Field(None, description="Database table name")
    fields: List[FieldInfo] = Field(default_factory=list, description="Model fields")
    is_abstract: bool = Field(default=False, description="Whether model is abstract")
    description: Optional[str] = Field(None, description="Model documentation")
    meta_options: Dict[str, Any] = Field(
        default_factory=dict, description="Django Meta options"
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        """Validate model name is non-empty."""
        if not v or not v.strip():
            raise ValueError("Model name cannot be empty")
        return v.strip()

    @field_validator("app_label")
    @classmethod
    def validate_app_label(cls, v):
        """Validate app label is non-empty."""
        if not v or not v.strip():
            raise ValueError("App label cannot be empty")
        return v.strip()

    def get_field(self, field_name: str) -> Optional[FieldInfo]:
        """Get field by name."""
        return next((field for field in self.fields if field.name == field_name), None)

    def has_field(self, field_name: str) -> bool:
        """Check if model has a field."""
        return any(field.name == field_name for field in self.fields)


class Relationship(BaseModel):
    """Represents a relationship between two models."""

    id: str = Field(
        default_factory=lambda: str(uuid4()), description="Unique identifier"
    )
    source_model: str = Field(..., description="Source model name", min_length=1)
    target_model: str = Field(..., description="Target model name", min_length=1)
    relationship_type: RelationshipType = Field(..., description="Type of relationship")
    field_name: str = Field(..., description="Field name on source model", min_length=1)
    related_name: Optional[str] = Field(
        None, description="Related name on target model"
    )
    through_model: Optional[str] = Field(
        None, description="Through model for M2M relationships"
    )
    is_nullable: bool = Field(
        default=True, description="Whether relationship can be null"
    )
    description: Optional[str] = Field(None, description="Relationship description")

    @field_validator("source_model")
    @classmethod
    def validate_source_model(cls, v):
        """Validate source model name is non-empty."""
        if not v or not v.strip():
            raise ValueError("Source model name cannot be empty")
        return v.strip()

    @field_validator("target_model")
    @classmethod
    def validate_target_model(cls, v):
        """Validate target model name is non-empty."""
        if not v or not v.strip():
            raise ValueError("Target model name cannot be empty")
        return v.strip()

    @field_validator("field_name")
    @classmethod
    def validate_field_name(cls, v):
        """Validate field name is non-empty."""
        if not v or not v.strip():
            raise ValueError("Field name cannot be empty")
        return v.strip()

    @model_validator(mode="after")
    def validate_relationship(self):
        """Validate relationship consistency."""
        source = self.source_model.strip()
        target = self.target_model.strip()

        if source == target:
            # Self-referential relationship is allowed
            pass

        # Validate through model for M2M
        rel_type = self.relationship_type
        through = self.through_model

        if rel_type == RelationshipType.MANY_TO_MANY and not through:
            # Through model is optional for M2M, can be auto-generated
            pass

        return self


class SchemaGraph(BaseModel):
    """Complete graph structure representing the discovered schema."""

    nodes: List[ModelNode] = Field(
        default_factory=list, description="All models in the schema"
    )
    relationships: List[Relationship] = Field(
        default_factory=list, description="All relationships"
    )
    apps: Set[str] = Field(
        default_factory=set, description="Set of app labels in schema"
    )
    discovery_timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="When schema was discovered"
    )
    nautobot_version: Optional[str] = Field(None, description="Nautobot version")

    @field_validator("nodes")
    @classmethod
    def validate_unique_nodes(cls, v):
        """Ensure node names are unique."""
        names = [node.name for node in v]
        if len(names) != len(set(names)):
            duplicates = [name for name in names if names.count(name) > 1]
            raise ValueError(f"Duplicate model names found: {duplicates}")
        return v

    @model_validator(mode="after")
    def validate_relationships_and_update_apps(self):
        """Ensure all relationships reference existing models and update apps set."""
        model_names = {node.name for node in self.nodes}

        for rel in self.relationships:
            if rel.source_model not in model_names:
                raise ValueError(
                    f"Relationship source '{rel.source_model}' not found in models"
                )
            if rel.target_model not in model_names:
                raise ValueError(
                    f"Relationship target '{rel.target_model}' not found in models"
                )
            if rel.through_model and rel.through_model not in model_names:
                raise ValueError(
                    f"Through model '{rel.through_model}' not found in models"
                )

        # Update apps set based on nodes
        self.apps = {node.app_label for node in self.nodes}

        return self

    def get_model(self, model_name: str) -> Optional[ModelNode]:
        """Get model by name."""
        return next((node for node in self.nodes if node.name == model_name), None)

    def get_relationships_for_model(self, model_name: str) -> List[Relationship]:
        """Get all relationships involving a model."""
        return [
            rel
            for rel in self.relationships
            if rel.source_model == model_name or rel.target_model == model_name
        ]

    def get_models_by_app(self, app_label: str) -> List[ModelNode]:
        """Get all models for a specific app."""
        return [node for node in self.nodes if node.app_label == app_label]

    def to_react_flow(self) -> Dict[str, Any]:
        """Convert schema to React Flow format."""
        react_nodes = []
        react_edges = []

        # Convert nodes
        for node in self.nodes:
            react_nodes.append(
                {
                    "id": node.id,
                    "type": "modelNode",
                    "data": {
                        "label": node.name,
                        "appLabel": node.app_label,
                        "fields": [
                            {
                                "name": field.name,
                                "type": field.field_type,
                                "nullable": field.is_nullable,
                                "isList": field.is_list,
                                "description": field.description,
                            }
                            for field in node.fields
                        ],
                        "isAbstract": node.is_abstract,
                        "description": node.description,
                    },
                    "position": {"x": 0, "y": 0},  # Frontend will handle positioning
                }
            )

        # Convert relationships to edges
        for rel in self.relationships:
            source_node = self.get_model(rel.source_model)
            target_node = self.get_model(rel.target_model)

            if source_node and target_node:
                react_edges.append(
                    {
                        "id": rel.id,
                        "source": source_node.id,
                        "target": target_node.id,
                        "type": "relationshipEdge",
                        "data": {
                            "relationshipType": rel.relationship_type.value,
                            "fieldName": rel.field_name,
                            "relatedName": rel.related_name,
                            "throughModel": rel.through_model,
                            "nullable": rel.is_nullable,
                            "description": rel.description,
                        },
                        "markerEnd": {"type": "arrowclosed"},
                    }
                )

        return {
            "nodes": react_nodes,
            "edges": react_edges,
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }

    def to_cytoscape(self) -> Dict[str, List[Dict[str, Any]]]:
        """Convert schema to Cytoscape.js format."""
        elements = []

        # Add nodes
        for node in self.nodes:
            elements.append(
                {
                    "data": {
                        "id": node.id,
                        "label": node.name,
                        "app_label": node.app_label,
                        "field_count": len(node.fields),
                        "is_abstract": node.is_abstract,
                        "description": node.description,
                    },
                    "classes": f"model-node app-{node.app_label}",
                }
            )

        # Add edges
        for rel in self.relationships:
            source_node = self.get_model(rel.source_model)
            target_node = self.get_model(rel.target_model)

            if source_node and target_node:
                elements.append(
                    {
                        "data": {
                            "id": rel.id,
                            "source": source_node.id,
                            "target": target_node.id,
                            "relationship_type": rel.relationship_type.value,
                            "field_name": rel.field_name,
                            "related_name": rel.related_name,
                            "nullable": rel.is_nullable,
                        },
                        "classes": f"relationship-edge {rel.relationship_type.value}",
                    }
                )

        return {"elements": elements}

    def to_graphml(self) -> str:
        """Convert schema to GraphML format for export."""
        graphml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"',
            '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
            '         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns',
            '         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">',
            "",
            "  <!-- Node attributes -->",
            '  <key id="name" for="node" attr.name="name" attr.type="string"/>',
            '  <key id="app_label" for="node" attr.name="app_label" attr.type="string"/>',
            '  <key id="field_count" for="node" attr.name="field_count" attr.type="int"/>',
            '  <key id="is_abstract" for="node" attr.name="is_abstract" attr.type="boolean"/>',
            "",
            "  <!-- Edge attributes -->",
            '  <key id="relationship_type" for="edge" attr.name="relationship_type" attr.type="string"/>',
            '  <key id="field_name" for="edge" attr.name="field_name" attr.type="string"/>',
            '  <key id="nullable" for="edge" attr.name="nullable" attr.type="boolean"/>',
            "",
            '  <graph id="nautobot_schema" edgedefault="directed">',
            "",
        ]

        # Add nodes
        for node in self.nodes:
            graphml_lines.extend(
                [
                    f'    <node id="{node.id}">',
                    f'      <data key="name">{node.name}</data>',
                    f'      <data key="app_label">{node.app_label}</data>',
                    f'      <data key="field_count">{len(node.fields)}</data>',
                    f'      <data key="is_abstract">{"true" if node.is_abstract else "false"}</data>',
                    "    </node>",
                ]
            )

        # Add edges
        for rel in self.relationships:
            source_node = self.get_model(rel.source_model)
            target_node = self.get_model(rel.target_model)

            if source_node and target_node:
                graphml_lines.extend(
                    [
                        f'    <edge id="{rel.id}" source="{source_node.id}" target="{target_node.id}">',
                        f'      <data key="relationship_type">{rel.relationship_type.value}</data>',
                        f'      <data key="field_name">{rel.field_name}</data>',
                        f'      <data key="nullable">{"true" if rel.is_nullable else "false"}</data>',
                        "    </edge>",
                    ]
                )

        graphml_lines.extend(["", "  </graph>", "</graphml>"])

        return "\n".join(graphml_lines)


class SchemaStatistics(BaseModel):
    """Summary statistics about the discovered schema."""

    total_models: int = Field(..., description="Total number of models")
    total_relationships: int = Field(..., description="Total number of relationships")
    apps_count: int = Field(..., description="Number of Django apps")
    relationship_type_counts: Dict[RelationshipType, int] = Field(
        default_factory=dict, description="Count by relationship type"
    )
    models_per_app: Dict[str, int] = Field(
        default_factory=dict, description="Model count per app"
    )
    average_fields_per_model: float = Field(
        ..., description="Average number of fields per model"
    )
    models_with_no_relationships: int = Field(
        ..., description="Models with no relationships"
    )
    most_connected_model: Optional[str] = Field(
        None, description="Model with most relationships"
    )

    @classmethod
    def from_schema_graph(cls, schema: SchemaGraph) -> "SchemaStatistics":
        """Create statistics from a schema graph."""
        # Count relationships by type
        rel_type_counts = {}
        for rel_type in RelationshipType:
            rel_type_counts[rel_type] = sum(
                1 for rel in schema.relationships if rel.relationship_type == rel_type
            )

        # Count models per app
        models_per_app = {}
        for app in schema.apps:
            models_per_app[app] = len(schema.get_models_by_app(app))

        # Calculate average fields per model
        total_fields = sum(len(node.fields) for node in schema.nodes)
        avg_fields = total_fields / len(schema.nodes) if schema.nodes else 0

        # Find models with no relationships
        models_with_rels = set()
        for rel in schema.relationships:
            models_with_rels.add(rel.source_model)
            models_with_rels.add(rel.target_model)

        models_without_rels = len(
            [node for node in schema.nodes if node.name not in models_with_rels]
        )

        # Find most connected model
        connection_counts = {}
        for rel in schema.relationships:
            connection_counts[rel.source_model] = (
                connection_counts.get(rel.source_model, 0) + 1
            )
            connection_counts[rel.target_model] = (
                connection_counts.get(rel.target_model, 0) + 1
            )

        most_connected = (
            max(connection_counts.items(), key=lambda x: x[1])[0]
            if connection_counts
            else None
        )

        return cls(
            total_models=len(schema.nodes),
            total_relationships=len(schema.relationships),
            apps_count=len(schema.apps),
            relationship_type_counts=rel_type_counts,
            models_per_app=models_per_app,
            average_fields_per_model=round(avg_fields, 2),
            models_with_no_relationships=models_without_rels,
            most_connected_model=most_connected,
        )


class SchemaDiscoveryResponse(BaseModel):
    """Response model for full schema discovery."""

    schema_graph: SchemaGraph = Field(..., description="Complete discovered schema")
    statistics: SchemaStatistics = Field(..., description="Schema statistics")
    discovery_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Metadata about discovery process"
    )
    cached: bool = Field(default=False, description="Whether response came from cache")
    cache_timestamp: Optional[datetime] = Field(
        None, description="When data was cached"
    )

    @classmethod
    def from_schema_graph(
        cls,
        schema: SchemaGraph,
        metadata: Optional[Dict[str, Any]] = None,
        cached: bool = False,
        cache_timestamp: Optional[datetime] = None,
    ) -> "SchemaDiscoveryResponse":
        """Create response from schema graph."""
        return cls(
            schema_graph=schema,
            statistics=SchemaStatistics.from_schema_graph(schema),
            discovery_metadata=metadata or {},
            cached=cached,
            cache_timestamp=cache_timestamp,
        )


class FilteredSchemaResponse(BaseModel):
    """Response model for filtered schema subsets."""

    schema_graph: SchemaGraph = Field(..., description="Filtered schema subset")
    statistics: SchemaStatistics = Field(
        ..., description="Statistics for filtered subset"
    )
    filters_applied: Dict[str, Any] = Field(
        ..., description="Filters that were applied"
    )
    original_total_models: int = Field(..., description="Total models before filtering")
    original_total_relationships: int = Field(
        ..., description="Total relationships before filtering"
    )

    @classmethod
    def from_filtered_graph(
        cls,
        filtered_schema: SchemaGraph,
        filters_applied: Dict[str, Any],
        original_totals: Dict[str, int],
    ) -> "FilteredSchemaResponse":
        """Create filtered response from schema graph."""
        return cls(
            schema_graph=filtered_schema,
            statistics=SchemaStatistics.from_schema_graph(filtered_schema),
            filters_applied=filters_applied,
            original_total_models=original_totals.get("models", 0),
            original_total_relationships=original_totals.get("relationships", 0),
        )
