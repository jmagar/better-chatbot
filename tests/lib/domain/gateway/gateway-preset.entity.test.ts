import { describe, it, expect } from 'vitest';
import { GatewayPresetEntity } from '@/lib/domain/gateway/gateway-preset.entity';
import type {
  GatewayPresetRecord,
  GatewayServerConfig,
} from '@/lib/domain/gateway/gateway-preset.entity';

describe('GatewayPresetEntity', () => {
  const validUserId = '550e8400-e29b-41d4-a716-446655440000';

  describe('create()', () => {
    it('should create preset with valid data', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'my-toolkit',
        name: 'My Toolkit',
        visibility: 'private',
      });

      expect(preset.slug).toBe('my-toolkit');
      expect(preset.status).toBe('active');
      expect(preset.userId).toBe(validUserId);
    });

    it('should default visibility to private', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(preset.visibility).toBe('private');
    });

    it('should reject invalid userId format', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: 'invalid-user-id',
          slug: 'test',
          name: 'Test',
        })
      ).toThrow('userId: Invalid UUID v4 format');
    });

    it('should reject empty userId', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: '',
          slug: 'test',
          name: 'Test',
        })
      ).toThrow('userId: Invalid userId');
    });

    it('should reject invalid slug format', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'Invalid Slug!',
          name: 'Test',
        })
      ).toThrow('slug: Invalid format');
    });

    it('should reject slug starting with hyphen', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: '-invalid',
          name: 'Test',
        })
      ).toThrow('slug: Cannot start or end with hyphen');
    });

    it('should reject slug ending with hyphen', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'invalid-',
          name: 'Test',
        })
      ).toThrow('slug: Cannot start or end with hyphen');
    });

    it('should reject short slug', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'ab',
          name: 'Test',
        })
      ).toThrow('slug: Must be 3-50 characters');
    });

    it('should reject long slug', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'a'.repeat(51),
          name: 'Test',
        })
      ).toThrow('slug: Must be 3-50 characters');
    });

    it('should reject empty name', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'test',
          name: '',
        })
      ).toThrow('name: Invalid name');
    });

    it('should reject long name', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'test',
          name: 'a'.repeat(101),
        })
      ).toThrow('name: Must be 1-100 characters');
    });

    it('should reject long description', () => {
      expect(() =>
        GatewayPresetEntity.create({
          userId: validUserId,
          slug: 'test',
          name: 'Test',
          description: 'a'.repeat(501),
        })
      ).toThrow('description: Must be max 500 characters');
    });
  });

  describe('fromRecord()', () => {
    it('should restore entity from record', () => {
      const now = new Date();
      const record: GatewayPresetRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: validUserId,
        slug: 'test-preset',
        name: 'Test Preset',
        description: 'A test preset',
        visibility: 'public',
        status: 'active',
        metadata: { key: 'value' },
        createdAt: now,
        updatedAt: now,
      };

      const servers: GatewayServerConfig[] = [
        {
          id: 'server-1',
          mcpServerId: 'mcp-1',
          enabled: true,
          allowedToolNames: ['tool1'],
        },
      ];

      const preset = GatewayPresetEntity.fromRecord(record, servers);

      expect(preset.id).toBe(record.id);
      expect(preset.userId).toBe(record.userId);
      expect(preset.slug).toBe(record.slug);
      expect(preset.name).toBe(record.name);
      expect(preset.description).toBe(record.description);
      expect(preset.visibility).toBe(record.visibility);
      expect(preset.status).toBe(record.status);
      expect(preset.metadata).toEqual({ key: 'value' });
      expect(preset.servers).toHaveLength(1);
    });

    it('should handle empty servers array', () => {
      const now = new Date();
      const record: GatewayPresetRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: validUserId,
        slug: 'test-preset',
        name: 'Test Preset',
        visibility: 'private',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const preset = GatewayPresetEntity.fromRecord(record);

      expect(preset.servers).toHaveLength(0);
    });
  });

  describe('canBeAccessedBy()', () => {
    it('should allow access for public preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'public-preset',
        name: 'Public',
        visibility: 'public',
      });

      expect(preset.canBeAccessedBy(undefined)).toBe(true);
      expect(preset.canBeAccessedBy('550e8400-e29b-41d4-a716-446655440001')).toBe(
        true
      );
    });

    it('should restrict access for private preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'private-preset',
        name: 'Private',
        visibility: 'private',
      });

      expect(preset.canBeAccessedBy(undefined)).toBe(false);
      expect(preset.canBeAccessedBy(validUserId)).toBe(true);
      expect(preset.canBeAccessedBy('550e8400-e29b-41d4-a716-446655440001')).toBe(
        false
      );
    });
  });

  describe('addServer()', () => {
    it('should add server to preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      const initialUpdatedAt = preset.updatedAt;

      preset.addServer({
        mcpServerId: 'server-1',
        enabled: true,
        allowedToolNames: ['tool1', 'tool2'],
      });

      expect(preset.servers).toHaveLength(1);
      expect(preset.servers[0].mcpServerId).toBe('server-1');
      expect(preset.servers[0].id).toBeDefined();
      expect(preset.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });

    it('should reject duplicate server', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.addServer({
        mcpServerId: 'server-1',
        enabled: true,
        allowedToolNames: [],
      });

      expect(() =>
        preset.addServer({
          mcpServerId: 'server-1',
          enabled: false,
          allowedToolNames: [],
        })
      ).toThrow('Server already exists in preset');
    });

    it('should enforce max 20 servers limit', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
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

    it('should reject too many tools per server', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      const toolNames = Array.from({ length: 101 }, (_, i) => `tool-${i}`);

      expect(() =>
        preset.addServer({
          mcpServerId: 'server-1',
          enabled: true,
          allowedToolNames: toolNames,
        })
      ).toThrow('Maximum 100 tools per server');
    });

    it('should reject tool name that is too long', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(() =>
        preset.addServer({
          mcpServerId: 'server-1',
          enabled: true,
          allowedToolNames: ['a'.repeat(101)],
        })
      ).toThrow('Tool name too long (max 100 chars)');
    });
  });

  describe('removeServer()', () => {
    it('should remove server from preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.addServer({
        mcpServerId: 'server-1',
        enabled: true,
        allowedToolNames: [],
      });

      const serverId = preset.servers[0].id!;
      const initialUpdatedAt = preset.updatedAt;

      preset.removeServer(serverId);

      expect(preset.servers).toHaveLength(0);
      expect(preset.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });

    it('should throw error when server not found', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(() => preset.removeServer('non-existent-id')).toThrow(
        'Server not found in preset'
      );
    });
  });

  describe('updateMetadata()', () => {
    it('should update metadata key', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      const initialUpdatedAt = preset.updatedAt;

      preset.updateMetadata('key1', 'value1');

      expect(preset.metadata).toEqual({ key1: 'value1' });
      expect(preset.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });

    it('should support multiple metadata keys', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.updateMetadata('key1', 'value1');
      preset.updateMetadata('key2', { nested: 'object' });

      expect(preset.metadata).toEqual({
        key1: 'value1',
        key2: { nested: 'object' },
      });
    });

    it('should reject invalid metadata key', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(() => preset.updateMetadata('', 'value')).toThrow(
        'metadata: Invalid key'
      );
    });

    it('should reject long metadata key', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(() => preset.updateMetadata('a'.repeat(101), 'value')).toThrow(
        'metadata: Key too long (max 100 chars)'
      );
    });
  });

  describe('updateName()', () => {
    it('should update name', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Original Name',
      });

      const initialUpdatedAt = preset.updatedAt;

      preset.updateName('New Name');

      expect(preset.name).toBe('New Name');
      expect(preset.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });

    it('should reject invalid name', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(() => preset.updateName('')).toThrow('name: Invalid name');
    });
  });

  describe('updateDescription()', () => {
    it('should update description', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.updateDescription('New description');

      expect(preset.description).toBe('New description');
    });

    it('should clear description', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
        description: 'Original',
      });

      preset.updateDescription(undefined);

      expect(preset.description).toBeUndefined();
    });

    it('should reject long description', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      expect(() => preset.updateDescription('a'.repeat(501))).toThrow(
        'description: Must be max 500 characters'
      );
    });
  });

  describe('updateVisibility()', () => {
    it('should update visibility', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
        visibility: 'private',
      });

      preset.updateVisibility('public');

      expect(preset.visibility).toBe('public');
    });
  });

  describe('disable()', () => {
    it('should disable preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      const initialUpdatedAt = preset.updatedAt;

      preset.disable();

      expect(preset.status).toBe('disabled');
      expect(preset.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });
  });

  describe('enable()', () => {
    it('should enable preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.disable();
      preset.enable();

      expect(preset.status).toBe('active');
    });
  });

  describe('archive()', () => {
    it('should archive preset', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      const initialUpdatedAt = preset.updatedAt;

      preset.archive();

      expect(preset.status).toBe('archived');
      expect(preset.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialUpdatedAt.getTime()
      );
    });
  });

  describe('toPersistence()', () => {
    it('should serialize to persistence record', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test-preset',
        name: 'Test Preset',
        description: 'A test',
        visibility: 'public',
      });

      preset.updateMetadata('key', 'value');

      const record = preset.toPersistence();

      expect(record.id).toBe(preset.id);
      expect(record.userId).toBe(validUserId);
      expect(record.slug).toBe('test-preset');
      expect(record.name).toBe('Test Preset');
      expect(record.description).toBe('A test');
      expect(record.visibility).toBe('public');
      expect(record.status).toBe('active');
      expect(record.metadata).toEqual({ key: 'value' });
    });

    it('should return defensive copy of metadata', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.updateMetadata('key', 'value');

      const record = preset.toPersistence();
      record.metadata!['key'] = 'modified';

      expect(preset.metadata).toEqual({ key: 'value' });
    });
  });

  describe('encapsulation', () => {
    it('should return defensive copy of metadata from getter', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.updateMetadata('key', 'value');

      const metadata = preset.metadata;
      metadata!['key'] = 'modified';

      expect(preset.metadata).toEqual({ key: 'value' });
    });

    it('should return defensive copy of servers from getter', () => {
      const preset = GatewayPresetEntity.create({
        userId: validUserId,
        slug: 'test',
        name: 'Test',
      });

      preset.addServer({
        mcpServerId: 'server-1',
        enabled: true,
        allowedToolNames: [],
      });

      const servers = preset.servers;
      servers.push({
        id: 'fake-id',
        mcpServerId: 'fake-server',
        enabled: false,
        allowedToolNames: [],
      });

      expect(preset.servers).toHaveLength(1);
    });
  });
});
