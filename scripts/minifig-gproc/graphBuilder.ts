/**
 * @file graphBuilder.ts
 * @description Minimal GPROC JSON builder for minifig parts (BRICK-MF2b).
 */

export type Vec3 = [number, number, number];

export type GProcSocket = { id: string; name: string; type: string };

export type GProcNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  inputs: GProcSocket[];
  outputs: GProcSocket[];
  properties: Record<string, unknown>;
};

export type GProcLink = {
  id: string;
  fromNodeId: string;
  fromSocketId: string;
  toNodeId: string;
  toSocketId: string;
};

export type GProcGraph = {
  id: string;
  name: string;
  version: number;
  metadata: { coordinateSystem: string; kind: string };
  nodes: GProcNode[];
  links: GProcLink[];
};

/** Handle to a node's geometry output (nodeId + socketId). */
export type GeoRef = { nodeId: string; socketId: string };

const GEO: GProcSocket = { id: 'geometry', name: 'geometry', type: 'geometry' };

export class GraphBuilder {
  private nodes: GProcNode[] = [];
  private links: GProcLink[] = [];
  private seq = 0;
  private cursorY = 0;
  private readonly id: string;
  private readonly name: string;
  private readonly kind: string;

  constructor(id: string, name: string, kind: string) {
    this.id = id;
    this.name = name;
    this.kind = kind;
  }

  private nid(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  private place(): { x: number; y: number } {
    const pos = { x: (this.seq % 6) * 180, y: this.cursorY };
    this.cursorY += 80;
    return pos;
  }

  private addNode(
    type: string,
    prefix: string,
    inputs: GProcSocket[],
    outputs: GProcSocket[],
    properties: Record<string, unknown>
  ): GProcNode {
    const node: GProcNode = {
      id: this.nid(prefix),
      type,
      position: this.place(),
      inputs,
      outputs,
      properties,
    };
    this.nodes.push(node);
    return node;
  }

  private link(from: GeoRef, toNodeId: string, toSocketId: string): void {
    this.links.push({
      id: `l_${this.links.length + 1}`,
      fromNodeId: from.nodeId,
      fromSocketId: from.socketId,
      toNodeId,
      toSocketId,
    });
  }

  private outRef(node: GProcNode): GeoRef {
    return { nodeId: node.id, socketId: node.outputs[0]!.id };
  }

  cylinder(
    opts: { radius: number; depth: number; vertices?: number; fillCap?: boolean } = {
      radius: 1,
      depth: 1,
    }
  ): GeoRef {
    const n = this.addNode(
      'PrimitiveCylinder',
      'cyl',
      [],
      [GEO],
      {
        radius: opts.radius,
        depth: opts.depth,
        vertices: opts.vertices ?? 20,
        fillCap: opts.fillCap ?? true,
      }
    );
    return this.outRef(n);
  }

  cube(opts: { size: Vec3; center?: Vec3 }): GeoRef {
    const n = this.addNode('PrimitiveCube', 'cube', [], [GEO], {
      size: opts.size,
      center: opts.center ?? [0, 0, 0],
    });
    return this.outRef(n);
  }

  chamferedBox(opts: { size: Vec3; center?: Vec3; bevel?: number }): GeoRef {
    const n = this.addNode('PrimitiveChamferedBox', 'cbox', [], [GEO], {
      size: opts.size,
      center: opts.center ?? [0, 0, 0],
      bevel: opts.bevel ?? 0.02,
    });
    return this.outRef(n);
  }

  /** Profile curve in XY (radius, y, 0) for Lathe around Y. */
  polyline(points: Vec3[]): GeoRef {
    const n = this.addNode('PrimitivePolyline', 'poly', [], [GEO], {
      points,
      fill: false,
    });
    return this.outRef(n);
  }

  lathe(
    curve: GeoRef,
    opts?: { segments?: number; fillCaps?: boolean; startAngle?: number; endAngle?: number }
  ): GeoRef {
    const n = this.addNode(
      'Lathe',
      'lathe',
      [{ id: 'curve', name: 'curve', type: 'geometry' }],
      [GEO],
      {
        segments: opts?.segments ?? 24,
        axis: [0, 1, 0],
        origin: [0, 0, 0],
        startAngle: opts?.startAngle ?? 0,
        endAngle: opts?.endAngle ?? Math.PI * 2,
        fillCaps: opts?.fillCaps ?? true,
      }
    );
    this.link(curve, n.id, 'curve');
    return this.outRef(n);
  }

  transform(
    geo: GeoRef,
    opts: { translation?: Vec3; rotation?: Vec3; scale?: Vec3 } = {}
  ): GeoRef {
    const n = this.addNode(
      'TransformGeometry',
      'xf',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      {
        translation: opts.translation ?? [0, 0, 0],
        rotation: opts.rotation ?? [0, 0, 0],
        scale: opts.scale ?? [1, 1, 1],
      }
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  join(a: GeoRef, b: GeoRef): GeoRef {
    const n = this.addNode(
      'JoinGeometry',
      'join',
      [
        { id: 'geo1', name: 'geo1', type: 'geometry' },
        { id: 'geo2', name: 'geo2', type: 'geometry' },
      ],
      [GEO],
      {}
    );
    this.link(a, n.id, 'geo1');
    this.link(b, n.id, 'geo2');
    return this.outRef(n);
  }

  /** Join many geos left-to-right. */
  joinAll(geos: GeoRef[]): GeoRef {
    if (geos.length === 0) throw new Error('joinAll: empty');
    let acc = geos[0]!;
    for (let i = 1; i < geos.length; i++) acc = this.join(acc, geos[i]!);
    return acc;
  }

  subtract(a: GeoRef, b: GeoRef): GeoRef {
    const n = this.addNode(
      'Boolean',
      'sub',
      [
        { id: 'geoA', name: 'geometryA', type: 'geometry' },
        { id: 'geoB', name: 'geometryB', type: 'geometry' },
      ],
      [GEO],
      { operation: 'subtract' }
    );
    this.link(a, n.id, 'geoA');
    this.link(b, n.id, 'geoB');
    return this.outRef(n);
  }

  flip(geo: GeoRef): GeoRef {
    const n = this.addNode(
      'FlipFaces',
      'flip',
      [{ id: 'geo', name: 'geometry', type: 'geometry' }],
      [GEO],
      {}
    );
    this.link(geo, n.id, 'geo');
    return this.outRef(n);
  }

  shadeSmooth(geo: GeoRef, angle = 180): GeoRef {
    const n = this.addNode(
      'SetShadeSmooth',
      'smooth',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      { angle }
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  shadeFlat(geo: GeoRef): GeoRef {
    const n = this.addNode(
      'SetShadeFlat',
      'flat',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      {}
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  triangulate(geo: GeoRef): GeoRef {
    const n = this.addNode(
      'Triangulate',
      'tri',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      {}
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  /**
   * Solid of revolution around Y. Each run is lathed and shaded smooth on its own,
   * so joints between runs stay sharp. Profiles are [radius, y, 0]; walk them
   * counter-clockwise in (radius, y) for outward normals.
   */
  revolve(
    runs: Vec3[][],
    opts?: { segments?: number; startAngle?: number; endAngle?: number }
  ): GeoRef {
    return this.joinAll(
      runs.map((run) =>
        this.shadeSmooth(this.lathe(this.polyline(run), { ...opts, fillCaps: false }))
      )
    );
  }

  /** Flat convex polygon; counter-clockwise points face the viewer. */
  flatPolygon(points: Vec3[]): GeoRef {
    return this.shadeFlat(this.triangulate(this.filledPolygon(points)));
  }

  /** Filled n-gon (no triangulate) — feed ExtrudeMesh so sides stay a single wall loop. */
  filledPolygon(points: Vec3[]): GeoRef {
    const n = this.addNode('PrimitivePolyline', 'poly', [], [GEO], { points, fill: true });
    return this.outRef(n);
  }

  /** Extrude along the face normal. `scale` shrinks/grows the extruded cap about its centroid. */
  extrude(geo: GeoRef, opts: { offset: number; scale?: number }): GeoRef {
    const n = this.addNode(
      'ExtrudeMesh',
      'extrude',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      { offset: opts.offset, scale: opts.scale ?? 1 }
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  material(geo: GeoRef, index = 0): GeoRef {
    const n = this.addNode(
      'SetMaterialIndex',
      'mat',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      { index }
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  /** Brick-Racer MF3: deterministic UV (Lathe emits none). */
  unwrapMinifig(geo: GeoRef, partKind: string, mirrorU: boolean): GeoRef {
    const n = this.addNode(
      'UnwrapMinifigPart',
      'unwrap',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      { partKind, mirrorU }
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  bakeMeshMaps(
    geo: GeoRef,
    props: {
      curvatureContrast: number;
      aoRadius: number;
      aoSamples: number;
      heightScale: number;
    }
  ): GeoRef {
    const n = this.addNode(
      'BakeMeshMaps',
      'bake',
      [{ id: 'geometry', name: 'geometry', type: 'geometry' }],
      [GEO],
      {
        bakeCurvature: true,
        bakeAO: true,
        bakeHeight: true,
        curvatureContrast: props.curvatureContrast,
        aoRadius: props.aoRadius,
        aoSamples: props.aoSamples,
        heightScale: props.heightScale,
      }
    );
    this.link(geo, n.id, 'geometry');
    return this.outRef(n);
  }

  /** Finish graph: unwrap → MeshMaps bake → material → GroupOutput (MF3). */
  build(finalGeo: GeoRef): GProcGraph {
    const mirrorU = /-(l)$/.test(this.kind);
    const unwrapped = this.unwrapMinifig(finalGeo, this.kind, mirrorU);
    const baked = this.bakeMeshMaps(unwrapped, bakePreset(this.kind));
    const shaded = this.material(baked, 0);
    const out = this.addNode(
      'GroupOutput',
      'out',
      [{ id: 'geo_in', name: 'geometry', type: 'geometry' }],
      [],
      {}
    );
    this.link(shaded, out.id, 'geo_in');
    return {
      id: this.id,
      name: this.name,
      version: 1,
      metadata: { coordinateSystem: 'engine_y_up', kind: this.kind },
      nodes: this.nodes,
      links: this.links,
    };
  }
}

function bakePreset(kind: string): {
  curvatureContrast: number;
  aoRadius: number;
  aoSamples: number;
  heightScale: number;
} {
  const base = {
    curvatureContrast: 2.6,
    aoRadius: 0.09,
    aoSamples: 12,
    heightScale: 1.1,
  };
  const byKind: Record<string, Partial<typeof base>> = {
    'minifig-head': { aoRadius: 0.08, curvatureContrast: 2.5 },
    'minifig-torso': { aoRadius: 0.11, curvatureContrast: 2.4 },
    'minifig-arm-r': { aoRadius: 0.07, curvatureContrast: 2.7 },
    'minifig-arm-l': { aoRadius: 0.07, curvatureContrast: 2.7 },
    'minifig-leg-r': { aoRadius: 0.075, curvatureContrast: 2.7 },
    'minifig-leg-l': { aoRadius: 0.075, curvatureContrast: 2.7 },
    'minifig-hand': { aoRadius: 0.05, curvatureContrast: 3.0 },
    'minifig-hips': { aoRadius: 0.09, curvatureContrast: 2.5 },
    'minifig-hat': { aoRadius: 0.07, curvatureContrast: 2.5 },
    'minifig-wrench': { aoRadius: 0.055, curvatureContrast: 3.2 },
  };
  return { ...base, ...(byKind[kind] ?? {}) };
}

/** Elliptic arc in the (radius, y) profile plane, angles in degrees, both ends included. */
export function arc(
  center: [number, number],
  radii: [number, number],
  fromDeg: number,
  toDeg: number,
  steps: number
): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    pts.push([center[0] + radii[0] * Math.cos(t), center[1] + radii[1] * Math.sin(t), 0]);
  }
  return pts;
}

/** Cylinder runs along Y: smooth wall, flat caps, sharp rims. */
export function cylinderRuns(radius: number, height: number): Vec3[][] {
  const h = height * 0.5;
  return [
    [
      [0, -h, 0],
      [radius, -h, 0],
    ],
    [
      [radius, -h, 0],
      [radius, h, 0],
    ],
    [
      [radius, h, 0],
      [0, h, 0],
    ],
  ];
}

export function smoothCylinder(
  b: GraphBuilder,
  radius: number,
  height: number,
  segments = 24
): GeoRef {
  return b.revolve(cylinderRuns(radius, height), { segments });
}

export function mirrorX(b: GraphBuilder, geo: GeoRef): GeoRef {
  // FlipFaces also negates normals that TransformGeometry already mirrored correctly;
  // re-derive them from the fixed winding. Hard edges survive because every piece
  // already has split vertices there (separate revolve runs, shadeFlat faces).
  return b.shadeSmooth(b.flip(b.transform(geo, { scale: [-1, 1, 1] })));
}
