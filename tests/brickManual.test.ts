import { describe, expect, it } from 'vitest';
import {
  assembleManual,
  bakeShell,
  buildFountainBrickPoses,
  fountainShellReport,
  isInvertedDishPart,
  landmarkLdrawIds,
  ManualAssembleError,
  manualToLandmark,
  packLdrawInstanceData,
  partSizeMeters,
  validateManual,
} from '../src/racer/hub/brick';
import fountainManual from '../src/racer/hub/brick/manuals/fountain.manual.json';

describe('validateManual', () => {
  it('accepts the fountain manual', () => {
    const r = validateManual(fountainManual);
    expect(r.ok).toBe(true);
  });

  it('rejects unknown parts with a readable path', () => {
    const r = validateManual({
      ...fountainManual,
      steps: [{ title: 'x', ops: [{ op: 'brick', part: '9x9', color: 'cyan', at: [0, 0, 0] }] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.message.includes('unknown part'))).toBe(true);
    }
  });
});

describe('assembleManual + bakeShell', () => {
  it('culls interior of a solid box', () => {
    const raw = {
      id: 'test.box',
      version: 1,
      origin: [0, 0, 0],
      envelope: { size: [5, 3, 5] },
      steps: [
        {
          title: 'solid',
          ops: [
            {
              op: 'box',
              part: '1x1',
              color: 'sand',
              min: [-3, 0, -3],
              max: [3, 12, 3],
            },
          ],
        },
      ],
    };
    const assembled = assembleManual(raw);
    expect(assembled.bricks.length).toBeGreaterThan(40);
    const shell = bakeShell(assembled.bricks, assembled.occupancy, true);
    expect(shell.report.kept).toBeLessThan(shell.report.total);
    expect(shell.report.culled).toBeGreaterThan(0);
  });

  it('throws on overlapping bricks', () => {
    expect(() =>
      assembleManual({
        id: 'overlap',
        version: 1,
        origin: [0, 0, 0],
        envelope: { size: [3, 2, 3] },
        steps: [
          {
            title: 'dup',
            ops: [
              { op: 'brick', part: '1x1', color: 'white', at: [0, 0, 0] },
              { op: 'brick', part: '1x1', color: 'cyan', at: [0, 0, 0] },
            ],
          },
        ],
      })
    ).toThrow(ManualAssembleError);
  });
});

describe('fountain manual pipeline', () => {
  it('builds gray/cyan poses inside the BOM fountain envelope', () => {
    const poses = buildFountainBrickPoses(true);
    expect(poses.length).toBeGreaterThan(8);
    const gray = poses.filter((p) => p.colorId === 'gray').length;
    const cyan = poses.filter((p) => p.colorId === 'cyan').length;
    expect(gray).toBeGreaterThan(5);
    expect(cyan).toBeGreaterThan(2);
    for (const p of poses) {
      const [sx, sy, sz] = partSizeMeters(p.partId);
      expect(p.position[0] - sx / 2).toBeGreaterThanOrEqual(20 - 1.65);
      expect(p.position[0] + sx / 2).toBeLessThanOrEqual(20 + 1.65);
      expect(p.position[2] - sz / 2).toBeGreaterThanOrEqual(20 - 1.65);
      expect(p.position[2] + sz / 2).toBeLessThanOrEqual(20 + 1.65);
      expect(p.position[1] - sy / 2).toBeGreaterThanOrEqual(-0.05);
      expect(p.position[1] + sy / 2).toBeLessThanOrEqual(2.2);
    }
  });

  it('reports shell stats', () => {
    const full = fountainShellReport(false);
    const shell = fountainShellReport(true);
    expect(shell.kept).toBeLessThanOrEqual(full.kept);
    expect(shell.total).toBe(full.total);
  });

  it('manualToLandmark yields landmark.fountain id', () => {
    const { spec, batches } = manualToLandmark(fountainManual, { shell: true });
    expect(spec.id).toBe('landmark.fountain');
    expect(spec.poses.length).toBeGreaterThan(10);
    expect(batches).toBeGreaterThan(1);
  });

  it('exposes LDraw design ids for Brick Lab spawn', () => {
    const { spec } = manualToLandmark(fountainManual, { shell: true });
    const ids = landmarkLdrawIds(spec);
    expect(ids).toContain('6141');
    expect(ids).toContain('85080');
    expect(ids).toContain('3960');
    expect(ids).toContain('3941');
    expect(isInvertedDishPart('3960')).toBe(true);
    expect(isInvertedDishPart('3005')).toBe(false);
    const packed = packLdrawInstanceData(spec.poses.slice(0, 2));
    expect(packed.length).toBe(2 * 36);
  });
});
