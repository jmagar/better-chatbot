import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GatewayPresetCreate } from '@/lib/db/pg/repositories/gateway-preset-repository.pg';

// Mock database
vi.mock('@/lib/db/pg/db.pg', () => ({
  pgDb: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Gateway Preset Repository', () => {
  let pgGatewayPresetRepository: typeof import('@/lib/db/pg/repositories/gateway-preset-repository.pg').pgGatewayPresetRepository;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@/lib/db/pg/db.pg');
    mockDb = dbModule.pgDb;
    const repoModule = await import('@/lib/db/pg/repositories/gateway-preset-repository.pg');
    pgGatewayPresetRepository = repoModule.pgGatewayPresetRepository;
  });

  it('should create preset with validated slug', async () => {
    const mockPreset = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      slug: 'my-toolkit',
      name: 'My Toolkit',
      description: 'Custom preset',
      visibility: 'private' as const,
      status: 'active' as const,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockPreset]),
      }),
    });

    const data: GatewayPresetCreate = {
      userId: '550e8400-e29b-41d4-a716-446655440001',
      slug: 'my-toolkit',
      name: 'My Toolkit',
      description: 'Custom preset',
      visibility: 'private',
    };

    const result = await pgGatewayPresetRepository.create(data);
    expect(result.slug).toBe('my-toolkit');
  });

  it('should reject invalid slug format', async () => {
    const invalidData: GatewayPresetCreate = {
      userId: '550e8400-e29b-41d4-a716-446655440001',
      slug: 'Invalid Slug!',
      name: 'Test',
    };

    await expect(pgGatewayPresetRepository.create(invalidData)).rejects.toThrow(
      'Invalid slug format'
    );
  });

  it('should find preset by slug with servers (no N+1)', async () => {
    const mockResult = [
      {
        mcp_gateway_presets: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          userId: '550e8400-e29b-41d4-a716-446655440001',
          slug: 'my-toolkit',
          name: 'My Toolkit',
          description: null,
          visibility: 'public' as const,
          status: 'active' as const,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        mcp_gateway_servers: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          presetId: '550e8400-e29b-41d4-a716-446655440000',
          mcpServerId: '550e8400-e29b-41d4-a716-446655440003',
          enabled: true,
          allowedToolNames: ['tool1', 'tool2'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockResult),
        }),
      }),
    });

    const result = await pgGatewayPresetRepository.findBySlugWithServers('my-toolkit');
    expect(result).toBeDefined();
    expect(result?.servers).toHaveLength(1);
  });
});
