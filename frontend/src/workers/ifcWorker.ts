import * as WebIFC from 'web-ifc';
import type { GeometryData, SpatialNode, WorkerParseRequest } from '../types/ifc';

const ifcApi = new WebIFC.IfcAPI();
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    ifcApi.SetWasmPath('/');
    await ifcApi.Init();
    isInitialized = true;
  }
}

self.onmessage = async (event: MessageEvent<WorkerParseRequest>) => {
  const { action, buffer, fileName } = event.data;
  if (action !== 'PARSE_IFC') return;

  try {
    postMessage({ type: 'PROGRESS', stage: 'Initializing WebAssembly engine...', percent: 10 });
    await ensureInitialized();

    postMessage({ type: 'PROGRESS', stage: 'Parsing IFC binary stream...', percent: 30 });
    const uint8Array = new Uint8Array(buffer);
    const modelID = ifcApi.OpenModel(uint8Array, {
      COORDINATE_TO_ORIGIN: true
    });

    postMessage({ type: 'PROGRESS', stage: 'Extracting 3D geometry meshes...', percent: 50 });

    const geometries: GeometryData[] = [];
    const transferables: ArrayBuffer[] = [];

    // Stream meshes
    ifcApi.StreamAllMeshes(modelID, (flatMesh: WebIFC.FlatMesh) => {
      const expressID = flatMesh.expressID;
      let entityType = 'IfcProduct';
      try {
        const typeCode = ifcApi.GetLineType(modelID, expressID);
        entityType = ifcApi.GetNameFromTypeCode(typeCode) || 'IfcProduct';
      } catch {
        // fallback
      }

      const placedGeometries = flatMesh.geometries;
      for (let i = 0; i < placedGeometries.size(); i++) {
        const placed = placedGeometries.get(i);
        const geomData = ifcApi.GetGeometry(modelID, placed.geometryExpressID);
        const rawVerts = ifcApi.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize());
        const rawIndices = ifcApi.GetIndexArray(geomData.GetIndexData(), geomData.GetIndexDataSize());

        // Deinterleave vertex buffer: [x, y, z, nx, ny, nz]
        const numVerts = rawVerts.length / 6;
        const positions = new Float32Array(numVerts * 3);
        const normals = new Float32Array(numVerts * 3);

        for (let v = 0; v < numVerts; v++) {
          const srcIdx = v * 6;
          const dstIdx = v * 3;
          positions[dstIdx] = rawVerts[srcIdx];
          positions[dstIdx + 1] = rawVerts[srcIdx + 1];
          positions[dstIdx + 2] = rawVerts[srcIdx + 2];

          normals[dstIdx] = rawVerts[srcIdx + 3];
          normals[dstIdx + 1] = rawVerts[srcIdx + 4];
          normals[dstIdx + 2] = rawVerts[srcIdx + 5];
        }

        const indices = new Uint32Array(rawIndices);
        const matrixArray = Array.from(placed.flatTransformation);
        const colorArray: [number, number, number, number] = [
          placed.color.x,
          placed.color.y,
          placed.color.z,
          placed.color.w
        ];

        geometries.push({
          expressID,
          type: entityType,
          positions,
          normals,
          indices,
          matrix: matrixArray,
          color: colorArray
        });

        transferables.push(positions.buffer, normals.buffer, indices.buffer);
      }
    });

    postMessage({ type: 'PROGRESS', stage: 'Building spatial structure tree...', percent: 85 });

    // Build spatial tree from IFC schema
    const spatialTree = buildSpatialTree(modelID, fileName);

    postMessage({ type: 'PROGRESS', stage: 'Finalizing 3D scene...', percent: 100 });

    ifcApi.CloseModel(modelID);

    (postMessage as (message: unknown, transfer: Transferable[]) => void)(
      {
        type: 'COMPLETE',
        geometries,
        spatialTree,
        elementCount: geometries.length
      },
      transferables
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'ERROR', message: errorMsg });
  }
};

function buildSpatialTree(modelID: number, fallbackName: string): SpatialNode {
  try {
    const projects = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    if (projects.size() === 0) {
      return {
        express_id: 0,
        global_id: 'root',
        name: fallbackName || 'IFC Project',
        type: 'IfcProject',
        children: []
      };
    }

    const projectID = projects.get(0);
    return parseNodeRecursive(modelID, projectID);
  } catch {
    return {
      express_id: 0,
      global_id: 'root',
      name: fallbackName || 'IFC Project',
      type: 'IfcProject',
      children: []
    };
  }
}

function parseNodeRecursive(modelID: number, expressID: number): SpatialNode {
  let name = `Entity #${expressID}`;
  let type = 'IfcProduct';
  let globalId = `id-${expressID}`;

  try {
    const line = ifcApi.GetLine(modelID, expressID);
    if (line) {
      if (line.Name && line.Name.value) name = line.Name.value;
      if (line.GlobalId && line.GlobalId.value) globalId = line.GlobalId.value;
      const typeCode = ifcApi.GetLineType(modelID, expressID);
      type = ifcApi.GetNameFromTypeCode(typeCode) || type;
    }
  } catch {
    // fallback
  }

  const children: SpatialNode[] = [];

  // 1. Check IsDecomposedBy (RelAggregates)
  try {
    const relAggregates = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELAGGREGATES);
    for (let i = 0; i < relAggregates.size(); i++) {
      const relID = relAggregates.get(i);
      const rel = ifcApi.GetLine(modelID, relID);
      if (rel && rel.RelatingObject && rel.RelatingObject.value === expressID) {
        if (rel.RelatedObjects && Array.isArray(rel.RelatedObjects)) {
          for (const item of rel.RelatedObjects) {
            if (item && item.value) {
              children.push(parseNodeRecursive(modelID, item.value));
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Check ContainsElements (RelContainedInSpatialStructure)
  try {
    const relContained = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
    for (let i = 0; i < relContained.size(); i++) {
      const relID = relContained.get(i);
      const rel = ifcApi.GetLine(modelID, relID);
      if (rel && rel.RelatingStructure && rel.RelatingStructure.value === expressID) {
        if (rel.RelatedElements && Array.isArray(rel.RelatedElements)) {
          for (const item of rel.RelatedElements) {
            if (item && item.value) {
              children.push(parseNodeRecursive(modelID, item.value));
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    express_id: expressID,
    global_id: globalId,
    name,
    type,
    children
  };
}
