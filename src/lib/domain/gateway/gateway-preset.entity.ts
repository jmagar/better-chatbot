import { randomUUID } from 'crypto';

export type PresetVisibility = 'public' | 'private' | 'invite_only';
export type PresetStatus = 'active' | 'disabled' | 'archived';

export interface GatewayServerConfig {
  id?: string;
  mcpServerId: string;
  enabled: boolean;
  allowedToolNames: string[];
}

export interface GatewayPresetCreateData {
  userId: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: PresetVisibility;
}

export interface GatewayPresetRecord {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string;
  visibility: PresetVisibility;
  status: PresetStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class GatewayPresetEntity {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly slug: string,
    public name: string,
    public description: string | undefined,
    public visibility: PresetVisibility,
    public status: PresetStatus,
    public metadata: Record<string, unknown> | undefined,
    public servers: GatewayServerConfig[],
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  static create(data: GatewayPresetCreateData): GatewayPresetEntity {
    // Validate invariants
    GatewayPresetEntity.validateSlug(data.slug);
    GatewayPresetEntity.validateName(data.name);
    if (data.description) {
      GatewayPresetEntity.validateDescription(data.description);
    }

    return new GatewayPresetEntity(
      randomUUID(),
      data.userId,
      data.slug,
      data.name,
      data.description,
      data.visibility ?? 'private',
      'active',
      undefined,
      [],
      new Date(),
      new Date()
    );
  }

  static fromRecord(
    record: GatewayPresetRecord,
    servers: GatewayServerConfig[] = []
  ): GatewayPresetEntity {
    return new GatewayPresetEntity(
      record.id,
      record.userId,
      record.slug,
      record.name,
      record.description,
      record.visibility,
      record.status,
      record.metadata,
      servers,
      record.createdAt,
      record.updatedAt
    );
  }

  // Business logic methods

  canBeAccessedBy(userId: string | undefined): boolean {
    if (this.visibility === 'public') return true;
    if (!userId) return false;
    if (userId === this.userId) return true;
    return false; // invite_only checked via repository
  }

  addServer(config: Omit<GatewayServerConfig, 'id'>): void {
    if (this.servers.length >= 20) {
      throw new Error('Maximum 20 servers per preset');
    }

    // Validate tool names
    if (config.allowedToolNames.length > 100) {
      throw new Error('Maximum 100 tools per server');
    }

    for (const toolName of config.allowedToolNames) {
      if (toolName.length > 100) {
        throw new Error('Tool name too long (max 100 chars)');
      }
    }

    this.servers.push({
      id: randomUUID(),
      ...config,
    });
  }

  removeServer(serverId: string): void {
    this.servers = this.servers.filter((s) => s.id !== serverId);
  }

  updateMetadata(key: string, value: unknown): void {
    if (!this.metadata) this.metadata = {};
    this.metadata[key] = value;
    this.updatedAt = new Date();
  }

  disable(): void {
    this.status = 'disabled';
    this.updatedAt = new Date();
  }

  enable(): void {
    this.status = 'active';
    this.updatedAt = new Date();
  }

  archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  toPersistence(): GatewayPresetRecord {
    return {
      id: this.id,
      userId: this.userId,
      slug: this.slug,
      name: this.name,
      description: this.description,
      visibility: this.visibility,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Validation methods

  private static validateSlug(slug: string): void {
    if (!slug || typeof slug !== 'string') {
      throw new Error('Invalid slug');
    }
    if (slug.length < 3 || slug.length > 50) {
      throw new Error('Slug must be 3-50 characters');
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error('Invalid slug format: must be lowercase letters, numbers, and hyphens');
    }
    if (slug.startsWith('-') || slug.endsWith('-')) {
      throw new Error('Slug cannot start or end with hyphen');
    }
  }

  private static validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid name');
    }
    if (name.length < 1 || name.length > 100) {
      throw new Error('Name must be 1-100 characters');
    }
  }

  private static validateDescription(description: string): void {
    if (description.length > 500) {
      throw new Error('Description must be max 500 characters');
    }
  }
}
