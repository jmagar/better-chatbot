import { describe, it, expect } from 'vitest';
import { GatewayPresetEntity } from '@/lib/domain/gateway/gateway-preset.entity';

describe('GatewayPresetEntity', () => {
  it('should create preset with valid data', () => {
    const preset = GatewayPresetEntity.create({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      slug: 'my-toolkit',
      name: 'My Toolkit',
      visibility: 'private',
    });

    expect(preset.slug).toBe('my-toolkit');
    expect(preset.status).toBe('active');
  });

  it('should reject invalid slug format', () => {
    expect(() =>
      GatewayPresetEntity.create({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'Invalid Slug!',
        name: 'Test',
      })
    ).toThrow('Invalid slug format');
  });

  it('should reject slug starting with hyphen', () => {
    expect(() =>
      GatewayPresetEntity.create({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        slug: '-invalid',
        name: 'Test',
      })
    ).toThrow('Slug cannot start or end with hyphen');
  });

  it('should check access for public preset', () => {
    const preset = GatewayPresetEntity.create({
      userId: 'user-1',
      slug: 'public-preset',
      name: 'Public',
      visibility: 'public',
    });

    expect(preset.canBeAccessedBy(undefined)).toBe(true);
    expect(preset.canBeAccessedBy('user-2')).toBe(true);
  });

  it('should check access for private preset', () => {
    const preset = GatewayPresetEntity.create({
      userId: 'user-1',
      slug: 'private-preset',
      name: 'Private',
      visibility: 'private',
    });

    expect(preset.canBeAccessedBy(undefined)).toBe(false);
    expect(preset.canBeAccessedBy('user-1')).toBe(true);
    expect(preset.canBeAccessedBy('user-2')).toBe(false);
  });

  it('should add server respecting max limit', () => {
    const preset = GatewayPresetEntity.create({
      userId: 'user-1',
      slug: 'test',
      name: 'Test',
    });

    // Add 20 servers (max)
    for (let i = 0; i < 20; i++) {
      preset.addServer({
        mcpServerId: `server-${i}`,
        enabled: true,
        allowedToolNames: [],
      });
    }

    expect(preset.servers).toHaveLength(20);

    // 21st should fail
    expect(() =>
      preset.addServer({
        mcpServerId: 'server-21',
        enabled: true,
        allowedToolNames: [],
      })
    ).toThrow('Maximum 20 servers per preset');
  });
});
