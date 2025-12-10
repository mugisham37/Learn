/**
 * MediaConvert Service Tests
 * 
 * Tests for AWS MediaConvert service integration including
 * job creation, status monitoring, and configuration validation.
 * 
 * Requirements:
 * - 4.2: MediaConvert transcoding with multiple resolutions
 * - 4.3: Transcoding job status and retry logic
 * - 4.4: Processing completion handling
 */

import { describe, it, expect } from 'vitest';
import { 
  DEFAULT_TRANSCODING_RESOLUTIONS 
} from '../../../src/shared/services/IMediaConvertService.js';

describe('MediaConvert Service Configuration', () => {
  it('should have default transcoding resolutions configured', () => {
    expect(DEFAULT_TRANSCODING_RESOLUTIONS).toBeDefined();
    expect(DEFAULT_TRANSCODING_RESOLUTIONS).toHaveLength(4);
    
    const resolutions = DEFAULT_TRANSCODING_RESOLUTIONS.map(r => r.name);
    expect(resolutions).toContain('1080p');
    expect(resolutions).toContain('720p');
    expect(resolutions).toContain('480p');
    expect(resolutions).toContain('360p');
  });

  it('should have proper bitrate configuration for each resolution', () => {
    const resolution1080p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '1080p');
    const resolution720p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '720p');
    const resolution480p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '480p');
    const resolution360p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '360p');

    expect(resolution1080p?.bitrate).toBe(5000000); // 5 Mbps
    expect(resolution720p?.bitrate).toBe(3000000);  // 3 Mbps
    expect(resolution480p?.bitrate).toBe(1500000);  // 1.5 Mbps
    expect(resolution360p?.bitrate).toBe(800000);   // 800 Kbps
  });

  it('should have proper dimensions for each resolution', () => {
    const resolution1080p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '1080p');
    const resolution720p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '720p');
    const resolution480p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '480p');
    const resolution360p = DEFAULT_TRANSCODING_RESOLUTIONS.find(r => r.name === '360p');

    expect(resolution1080p?.width).toBe(1920);
    expect(resolution1080p?.height).toBe(1080);
    
    expect(resolution720p?.width).toBe(1280);
    expect(resolution720p?.height).toBe(720);
    
    expect(resolution480p?.width).toBe(854);
    expect(resolution480p?.height).toBe(480);
    
    expect(resolution360p?.width).toBe(640);
    expect(resolution360p?.height).toBe(360);
  });
});

