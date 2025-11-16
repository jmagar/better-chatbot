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
    private _name: string,
    private _description: string | undefined,
    private _visibility: PresetVisibility,
    private _status: PresetStatus,
    private _metadata: Record<string, unknown> | undefined,
    private _servers: GatewayServerConfig[],
    public readonly createdAt: Date,
    private _updatedAt: Date
  ) {}

  // Readonly getters
  get name(): string {
    return this._name;
  }

  get description(): string | undefined {
    return this._description;
  }

  get visibility(): PresetVisibility {
    return this._visibility;
  }

  get status(): PresetStatus {
    return this._status;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata ? { ...this._metadata } : undefined;
  }

  get servers(): GatewayServerConfig[] {
    return [...this._servers];
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  static create(data: GatewayPresetCreateData): GatewayPresetEntity {
    // Validate invariants
    GatewayPresetEntity.validateUserId(data.userId);
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
    if (this._servers.length >= 20) {
      throw new Error('Maximum 20 servers per preset');
    }

    // Prevent duplicate servers
    if (this._servers.some((s) => s.mcpServerId === config.mcpServerId)) {
      throw new Error('Server already exists in preset');
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

    this._servers.push({
      id: randomUUID(),
      ...config,
    });
    this._updatedAt = new Date();
  }

  removeServer(serverId: string): void {
    const initialLength = this._servers.length;
    this._servers = this._servers.filter((s) => s.id !== serverId);

    if (this._servers.length === initialLength) {
      throw new Error('Server not found in preset');
    }

    this._updatedAt = new Date();
  }

  updateMetadata(key: string, value: unknown): void {
    // Validate inputs
    if (!key || typeof key !== 'string') {
      throw new Error('metadata: Invalid key');
    }
    if (key.length > 100) {
      throw new Error('metadata: Key too long (max 100 chars)');
    }

    if (!this._metadata) this._metadata = {};
    this._metadata[key] = value;
    this._updatedAt = new Date();
  }

  updateName(name: string): void {
    GatewayPresetEntity.validateName(name);
    this._name = name;
    this._updatedAt = new Date();
  }

  updateDescription(description: string | undefined): void {
    if (description) {
      GatewayPresetEntity.validateDescription(description);
    }
    this._description = description;
    this._updatedAt = new Date();
  }

  updateVisibility(visibility: PresetVisibility): void {
    this._visibility = visibility;
    this._updatedAt = new Date();
  }

  disable(): void {
    this._status = 'disabled';
    this._updatedAt = new Date();
  }

  enable(): void {
    this._status = 'active';
    this._updatedAt = new Date();
  }

  archive(): void {
    this._status = 'archived';
    this._updatedAt = new Date();
  }

  toPersistence(): GatewayPresetRecord {
    return {
      id: this.id,
      userId: this.userId,
      slug: this.slug,
      name: this._name,
      description: this._description,
      visibility: this._visibility,
      status: this._status,
      metadata: this._metadata ? { ...this._metadata } : undefined,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }

  // Validation methods

  private static validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId: Invalid userId');
    }
    // UUID v4 format
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        userId
      )
    ) {
      throw new Error('userId: Invalid UUID v4 format');
    }
  }

  private static validateSlug(slug: string): void {
    if (!slug || typeof slug !== 'string') {
      throw new Error('slug: Invalid slug');
    }
    if (slug.length < 3 || slug.length > 50) {
      throw new Error('slug: Must be 3-50 characters');
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error(
        'slug: Invalid format - must be lowercase letters, numbers, and hyphens'
      );
    }
    if (slug.startsWith('-') || slug.endsWith('-')) {
      throw new Error('slug: Cannot start or end with hyphen');
    }
  }

  private static validateName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('name: Invalid name');
    }
    if (name.length < 1 || name.length > 100) {
      throw new Error('name: Must be 1-100 characters');
    }
  }

  private static validateDescription(description: string): void {
    if (description.length > 500) {
      throw new Error('description: Must be max 500 characters');
    }
  }
}
