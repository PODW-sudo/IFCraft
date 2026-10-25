import * as WebIFC from 'web-ifc';
import type { GeometryData, SpatialNode, WorkerParseRequest } from '../types/ifc';

const ifcApi = new WebIFC.IfcAPI();
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      const origin = (typeof self !== 'undefined' && self.location && self.location.origin)
        ? self.location.origin
        : '';
      const wasmBase = origin ? `${origin}/` : '/';
      ifcApi.SetWasmPath(wasmBase, true);
      await ifcApi.Init((path: string) => {
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
          return path;
        }
        const cleanPath = path.replace(/^\/+/, '');
        return origin ? `${origin}/${cleanPath}` : `/${cleanPath}`;
      }, true);
    })();
  }
  return initPromise;
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
      COORDINATE_TO_ORIGIN: false
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

/**
 * Metres per project unit for the model's length unit (`0.001` for a millimetre file, `1` for a
 * metre file). Read from `IfcProject.UnitsInContext` -> `IfcUnitAssignment.Units` -> the
 * `LENGTHUNIT` whose name is `METRE`, then from its SI prefix.
 *
 * `IfcConversionBasedUnit` (feet/inches) is out of scope: anything that is not a prefixed metre
 * falls back to `1` with a warning, so drawings still render.
 */
function readLengthUnitScale(modelID: number): number {
  try {
    const projects = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    if (projects.size() === 0) return 1;

    const project = ifcApi.GetLine(modelID, projects.get(0));
    const unitAssignmentId = project?.UnitsInContext?.value;
    if (!unitAssignmentId) return 1;

    const unitAssignment = ifcApi.GetLine(modelID, unitAssignmentId);
    const units = unitAssignment?.Units;
    if (!Array.isArray(units)) return 1;

    for (const unitRef of units) {
      const unitId = unitRef?.value;
      if (!unitId) continue;

      const unit = ifcApi.GetLine(modelID, unitId);
      // web-ifc returns enum attributes as `{ type: 3, value: 'LENGTHUNIT' }`.
      if (unit?.UnitType?.value !== 'LENGTHUNIT') continue;

      const name = unit?.Name?.value;
      if (name !== 'METRE') {
        console.warn(`Unsupported IFC length unit "${name}" - falling back to metres.`);
        return 1;
      }

      switch (unit?.Prefix?.value) {
        case 'MILLI':
          return 0.001;
        case 'CENTI':
          return 0.01;
        case 'DECI':
          return 0.1;
        case 'KILO':
          return 1000;
        case undefined:
        case null:
        case '':
          return 1;
        default:
          console.warn(`Unsupported SI prefix "${unit?.Prefix?.value}" - falling back to metres.`);
          return 1;
      }
    }
  } catch (err) {
    console.warn('Could not read the IFC length unit; assuming metres:', err);
  }
  return 1;
}

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

    // Build parent-to-children relationship map in a single O(N) pass
    const childrenMap = new Map<number, number[]>();

    const addChild = (parentId: number, childId: number) => {
      let list = childrenMap.get(parentId);
      if (!list) {
        list = [];
        childrenMap.set(parentId, list);
      }
      list.push(childId);
    };

    // 1. Index RelAggregates (Spatial decomposition: Project -> Site -> Building -> Storey)
    try {
      const relAggregates = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELAGGREGATES);
      for (let i = 0; i < relAggregates.size(); i++) {
        const relID = relAggregates.get(i);
        const rel = ifcApi.GetLine(modelID, relID);
        if (rel?.RelatingObject?.value && Array.isArray(rel.RelatedObjects)) {
          const parentId = rel.RelatingObject.value;
          for (const item of rel.RelatedObjects) {
            if (item?.value) addChild(parentId, item.value);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to index IFCRELAGGREGATES:', e);
    }

    // 2. Index RelContainedInSpatialStructure (Storey -> Elements)
    try {
      const relContained = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
      for (let i = 0; i < relContained.size(); i++) {
        const relID = relContained.get(i);
        const rel = ifcApi.GetLine(modelID, relID);
        if (rel?.RelatingStructure?.value && Array.isArray(rel.RelatedElements)) {
          const parentId = rel.RelatingStructure.value;
          for (const item of rel.RelatedElements) {
            if (item?.value) addChild(parentId, item.value);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to index IFCRELCONTAINEDINSPATIALSTRUCTURE:', e);
    }

    const projectID = projects.get(0);
    const unitScale = readLengthUnitScale(modelID);
    const root = parseNodeRecursive(modelID, projectID, childrenMap, new Set());
    // Metres per project unit, on the root node only - consumers read it once for the whole tree.
    return { ...root, unit_scale: unitScale };
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

function parseNodeRecursive(
  modelID: number,
  expressID: number,
  childrenMap: Map<number, number[]>,
  visited: Set<number>
): SpatialNode {
  if (visited.has(expressID)) {
    return {
      express_id: expressID,
      global_id: `id-${expressID}`,
      name: `Entity #${expressID}`,
      type: 'IfcProduct',
      children: []
    };
  }
  visited.add(expressID);

  let name = `Entity #${expressID}`;
  let type = 'IfcProduct';
  let globalId = `id-${expressID}`;
  let elevation: number | undefined;

  try {
    const line = ifcApi.GetLine(modelID, expressID);
    if (line) {
      if (line.Name?.value) name = line.Name.value;
      if (line.GlobalId?.value) globalId = line.GlobalId.value;
      const typeCode = ifcApi.GetLineType(modelID, expressID);
      type = ifcApi.GetNameFromTypeCode(typeCode) || type;

      // Storey elevation is in PROJECT UNITS (mm for a typical export), never in metres.
      if (type === 'IfcBuildingStorey') {
        const rawElevation = line.Elevation?.value;
        elevation = typeof rawElevation === 'number' && Number.isFinite(rawElevation)
          ? rawElevation
          : 0;
      }
    }
  } catch {
    // fallback
  }

  const childIds = childrenMap.get(expressID) || [];
  const children: SpatialNode[] = [];
  for (const cid of childIds) {
    children.push(parseNodeRecursive(modelID, cid, childrenMap, visited));
  }

  return {
    express_id: expressID,
    global_id: globalId,
    name,
    type,
    ...(elevation !== undefined ? { elevation } : {}),
    children
  };
}
