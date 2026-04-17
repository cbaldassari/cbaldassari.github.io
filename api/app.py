"""
Visibility Graph Embedding API
Converts univariate time series into fixed-length vectors via
visibility graph construction (ts2vg) and Diff2Vec graph embedding.
"""

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import pandas as pd
import networkx as nx
import json
import io
from ts2vg import NaturalVG, HorizontalVG
from karateclub import Diff2Vec

app = FastAPI(
    title="Visibility Graph Embedding API",
    version="1.0.0",
    description="Time series to graph embedding via visibility graphs and Diff2Vec.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


# --- Request schema ---

class VGRequest(BaseModel):
    values: list[float]
    method: str = "natural"
    embedding_dim: int = 128
    diffusion_number: int = 10
    diffusion_cover: int = 80


# --- Core logic ---

def build_vg(values: list[float], method: str) -> nx.Graph:
    """Build a visibility graph from a time series."""
    ts = np.array(values, dtype=np.float64)
    if method == "horizontal":
        vg = HorizontalVG()
    else:
        vg = NaturalVG()
    vg.build(ts)
    return vg.as_networkx()


def compute_embedding(
    graph: nx.Graph,
    embedding_dim: int,
    diffusion_number: int,
    diffusion_cover: int,
) -> list[float]:
    """Compute graph-level embedding using Diff2Vec.

    Diff2Vec produces node-level embeddings via Euler diffusion trees
    and skip-gram training. The graph-level embedding is the mean
    of all node vectors.
    """
    n = graph.number_of_nodes()
    if n < 3:
        raise ValueError("Time series too short (need at least 3 points)")

    model = Diff2Vec(
        dimensions=embedding_dim,
        diffusion_number=diffusion_number,
        diffusion_cover=min(diffusion_cover, n),
        workers=1,
    )
    model.fit(graph)
    node_embeddings = model.get_embedding()  # shape: (n, embedding_dim)
    graph_embedding = node_embeddings.mean(axis=0)
    return graph_embedding.tolist()


def parse_file(
    file_bytes: bytes, filename: str, column: str | None = None
) -> list[float]:
    """Parse a data file and extract a numeric column as a list of floats."""
    name = filename.lower()

    if name.endswith(".json"):
        data = json.loads(file_bytes)
        if isinstance(data, list):
            return [float(v) for v in data if isinstance(v, (int, float))]
        if isinstance(data, dict):
            if column and column in data:
                return [float(v) for v in data[column]]
            for key in data:
                if isinstance(data[key], list):
                    try:
                        return [float(v) for v in data[key]]
                    except (ValueError, TypeError):
                        continue
        raise ValueError("Cannot extract numeric array from JSON")

    # Tabular formats
    buf = io.BytesIO(file_bytes)
    if name.endswith(".parquet"):
        df = pd.read_parquet(buf)
    elif name.endswith(".xlsx") or name.endswith(".xls"):
        df = pd.read_excel(buf)
    elif name.endswith(".tsv"):
        df = pd.read_csv(buf, sep="\t")
    else:
        df = pd.read_csv(buf)

    if column:
        if column not in df.columns:
            raise ValueError(
                f"Column '{column}' not found. Available: {list(df.columns)}"
            )
        return df[column].dropna().astype(float).tolist()

    # Auto-detect first numeric column
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            return df[col].dropna().astype(float).tolist()

    raise ValueError("No numeric column found in file")


def make_response(
    values: list[float],
    method: str,
    embedding_dim: int,
    diffusion_number: int,
    diffusion_cover: int,
) -> dict:
    """Build VG, compute embedding, return structured response."""
    graph = build_vg(values, method)
    embedding = compute_embedding(
        graph, embedding_dim, diffusion_number, diffusion_cover
    )

    n = graph.number_of_nodes()
    e = graph.number_of_edges()
    max_edges = n * (n - 1) / 2

    adj_list = {
        int(node): sorted(int(nb) for nb in graph.neighbors(node))
        for node in graph.nodes()
    }

    return {
        "embedding": embedding,
        "graph": {
            "nodes": n,
            "edges": e,
            "density": round(e / max_edges, 6) if max_edges > 0 else 0,
            "adjacency_list": adj_list,
        },
        "method": method,
        "embedding_dim": len(embedding),
    }


# --- Endpoints ---

@app.post("/api/vg-embedding")
def vg_embedding(req: VGRequest):
    """Compute embedding from a JSON array of values."""
    if len(req.values) < 3:
        raise HTTPException(400, "Need at least 3 values")
    if len(req.values) > 10000:
        raise HTTPException(400, "Maximum 10000 values")
    try:
        return make_response(
            req.values, req.method, req.embedding_dim,
            req.diffusion_number, req.diffusion_cover,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/vg-embedding/upload")
async def vg_embedding_upload(
    file: UploadFile = File(...),
    column: str | None = Form(None),
    method: str = Form("natural"),
    embedding_dim: int = Form(128),
    diffusion_number: int = Form(10),
    diffusion_cover: int = Form(80),
):
    """Compute embedding from an uploaded data file."""
    content = await file.read()
    try:
        values = parse_file(content, file.filename, column)
    except Exception as e:
        raise HTTPException(400, f"File parsing error: {e}")

    if len(values) < 3:
        raise HTTPException(400, "Need at least 3 values after parsing")
    if len(values) > 10000:
        raise HTTPException(400, "Maximum 10000 values")

    try:
        return make_response(
            values, method, embedding_dim, diffusion_number, diffusion_cover
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/health")
def health():
    return {"status": "ok"}
