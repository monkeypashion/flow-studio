import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Group } from '../Group/Group';
import { GhostClip } from '../Clip/GhostClip';
import { SelectionOverlay } from '../SelectionOverlay/SelectionOverlay';
import { SnapIndicator } from '../SnapIndicator/SnapIndicator';
import { VisibilityTree } from '../VisibilityTree/VisibilityTree';
import { DateRangePicker } from '../DateRangePicker/DateRangePicker';
import { Navigator } from '../Navigator/Navigator';
// import { ClipManagerModal } from '../ClipManager/ClipManagerModal'; // Removed - using direct validation now
import { SpecialLane } from '../SpecialLane/SpecialLane';
import { motion } from 'framer-motion';
import './Timeline.css';

export const Timeline: React.FC = () => {
  const {
    dataJobs,
    activeJobId,
    timeline,
    ghostClips,
    selection,
    snapIndicatorPosition,
    inspectorVisible,
    jobQueueVisible,
    settingsVisible,
    showAssets,
    showAspects,
    showSource,
    showDestination,
    treeWidth,
    trackHeaderWidth,
    setScroll,
    setZoom,
    setPlayhead,
    addGroup,
    paste,
    clearSelection,
    removeSelectedClips,
    copySelection,
    cut,
    toggleInspector,
    toggleJobQueue,
    toggleSettings,
    toggleShowAssets,
    toggleShowAspects,
    toggleShowClipsOnly,
    toggleShowSource,
    toggleShowDestination,
    toggleSyncLinkedClipPositions,
    setSyncMode,
    showClipsOnly,
    tenants,
  } = useAppStore();

  // Get groups from active job
  const activeJob = dataJobs.find(job => job.id === activeJobId);
  const groups = activeJob?.groups || [];

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isDraggingHeaderResize, setIsDraggingHeaderResize] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null); // Track container width for proper sizing

  // Calculate timeline width
  // Track headers are resizable, independent of tree width
  const calculatedWidth = timeline.duration * timeline.zoom;
  // Ensure timeline always extends at least to fill the visible container
  // This prevents container background showing through when timeline is narrower than viewport
  // containerWidth is already the width AFTER the VisibilityTree, so just subtract track header
  const minWidth = containerWidth !== null
    ? Math.max(calculatedWidth, containerWidth - trackHeaderWidth)
    : calculatedWidth;
  const timelineWidth = minWidth + trackHeaderWidth;


  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScroll(target.scrollLeft, target.scrollTop);
  };

  // Handle playhead drag
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate x position relative to timeline container
        const x = e.clientX - rect.left;

        // Subtract track header width to get position in track content area
        // This ensures playhead can't go behind the track header
        const xInTrackArea = Math.max(trackHeaderWidth, x);

        // Convert to time (subtract header offset)
        let time = (xInTrackArea - trackHeaderWidth) / timeline.zoom;

        // Snap to grid if enabled
        if (timeline.gridSnap) {
          time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
        }

        // Clamp to valid time range
        time = Math.max(0, Math.min(time, timeline.duration));

        setPlayhead(time);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle timeline click to move playhead
  const handleTimelineClick = (e: React.MouseEvent) => {
    // Use currentTarget (the time ruler div) instead of timelineRef (tracks container)
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect && !isDraggingPlayhead) {
      // Calculate x position relative to time ruler
      const x = e.clientX - rect.left;

      // Subtract trackHeaderWidth offset since markers are offset to the right
      let time = (x - trackHeaderWidth) / timeline.zoom;

      // Snap to grid if enabled
      if (timeline.gridSnap) {
        time = Math.round(time / timeline.snapInterval) * timeline.snapInterval;
      }

      // Clamp to valid time range
      time = Math.max(0, Math.min(time, timeline.duration));

      setPlayhead(time);
    }
  };

  // Handle track header resize drag
  const handleHeaderResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingHeaderResize(true);

    const startX = e.clientX;
    const startWidth = trackHeaderWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;

      // setTrackHeaderWidth already enforces min/max constraints (100-400)
      useAppStore.getState().setTrackHeaderWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingHeaderResize(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Format time for display - converts relative seconds to absolute timestamp (local time)
  const formatTime = (relativeSeconds: number): string => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + relativeSeconds * 1000);

    // Format as local time in ISO-like format: YYYY-MM-DD HH:MM:SS
    const year = absoluteDate.getFullYear();
    const month = String(absoluteDate.getMonth() + 1).padStart(2, '0');
    const day = String(absoluteDate.getDate()).padStart(2, '0');
    const hours = String(absoluteDate.getHours()).padStart(2, '0');
    const minutes = String(absoluteDate.getMinutes()).padStart(2, '0');
    const seconds = String(absoluteDate.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // Format time as separate date and time strings for timeline markers (local time)
  const formatTimeForMarker = (relativeSeconds: number): { date: string; time: string } => {
    const startDate = new Date(timeline.startTime);
    const absoluteDate = new Date(startDate.getTime() + relativeSeconds * 1000);

    // Format as local time
    const year = absoluteDate.getFullYear();
    const month = String(absoluteDate.getMonth() + 1).padStart(2, '0');
    const day = String(absoluteDate.getDate()).padStart(2, '0');
    const hours = String(absoluteDate.getHours()).padStart(2, '0');
    const minutes = String(absoluteDate.getMinutes()).padStart(2, '0');
    const seconds = String(absoluteDate.getSeconds()).padStart(2, '0');

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  };

  // Generate time ruler markers
  const generateTimeMarkers = () => {
    const markers = [];

    // Calculate smart interval based on VIEWPORT duration (not total timeline duration)
    // This ensures markers are appropriate for what's actually visible
    let interval: number;
    const durationInHours = timeline.viewportDuration / 3600;

    if (durationInHours > 48) {
      // More than 2 days: show markers every 2 hours
      interval = 3600 * 2;
    } else if (durationInHours > 24) {
      // 1-2 days: show markers every hour
      interval = 3600;
    } else if (durationInHours > 12) {
      // 12-24 hours: show markers every 30 minutes
      interval = 1800;
    } else if (durationInHours > 6) {
      // 6-12 hours: show markers every 15 minutes
      interval = 900;
    } else if (durationInHours > 3) {
      // 3-6 hours: show markers every 10 minutes
      interval = 600;
    } else if (durationInHours > 1) {
      // 1-3 hours: show markers every 5 minutes
      interval = 300;
    } else {
      // Less than 1 hour: show markers every 2 minutes
      interval = 120;
    }

    // Limit total number of markers to prevent performance issues
    // Use TOTAL duration for marker count (markers span entire timeline, not just viewport)
    const maxMarkers = 300;
    const estimatedMarkers = Math.ceil(timeline.duration / interval);
    if (estimatedMarkers > maxMarkers) {
      interval = Math.ceil(timeline.duration / maxMarkers);
    }

    // Calculate minimum spacing between markers to prevent overlap
    // Approximate width of time marker label: ~80px (date + time on 2 lines)
    const MIN_LABEL_WIDTH = 80;
    const markerSpacingPx = interval * timeline.zoom;

    // Calculate skip factor: show every Nth marker when zoomed out
    let skipFactor = 1;
    if (markerSpacingPx < MIN_LABEL_WIDTH) {
      skipFactor = Math.ceil(MIN_LABEL_WIDTH / markerSpacingPx);
    }

    let markerIndex = 0;
    // Loop through ENTIRE timeline duration (not just viewport)
    // Markers must exist across full range so they're visible when scrolling
    for (let i = 0; i <= timeline.duration; i += interval) {
      // Skip markers to prevent overlap when zoomed out
      if (markerIndex % skipFactor !== 0) {
        markerIndex++;
        continue;
      }

      // i is time in seconds from timeline start
      const { date, time } = formatTimeForMarker(i);

      markers.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${trackHeaderWidth + (i * timeline.zoom)}px` }}
        >
          <div className="h-2 w-px bg-gray-600" />
          <div className="flex flex-col items-center mt-1">
            <span className="text-[10px] text-gray-500 leading-tight whitespace-nowrap">{date}</span>
            <span className="text-xs text-gray-400 leading-tight whitespace-nowrap">{time}</span>
          </div>
        </div>
      );

      markerIndex++;
    }

    return markers;
  };

  // Helper: Set all destination clips to 'uploading' state (preserve current progress)
  const setDestinationClipsToUploading = () => {
    if (!activeJob) return;

    // Find all destination clips and set to uploading (keep current progress)
    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(clip => {
            if (clip.linkType === 'destination') {
              // Keep current progress, just update state to uploading
              useAppStore.getState().updateClip(clip.id, {
                state: 'uploading'
                // Don't reset progress - it should stay where it was
              });
            }
          });
        });
      });
    });
  };

  // Helper: Update all destination clips' progress
  const updateDestinationClipsProgress = (progressPercent: number, state: 'uploading' | 'processing' | 'complete' | 'error') => {
    if (!activeJob) return;

    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(clip => {
            if (clip.linkType === 'destination') {
              useAppStore.getState().updateClip(clip.id, {
                state: state,
                progress: progressPercent
              });
            }
          });
        });
      });
    });
  };

  // Helper: Update destination clips with lastSyncedTime (for time-based progress)
  const updateDestinationClipsProgressWithTimestamp = (progressPercent: number, state: 'uploading' | 'processing' | 'complete' | 'error', lastSyncedTime: string) => {
    if (!activeJob) return;

    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(clip => {
            if (clip.linkType === 'destination') {
              useAppStore.getState().updateClip(clip.id, {
                state: state,
                progress: progressPercent,
                lastSyncedTime: lastSyncedTime
              });
            }
          });
        });
      });
    });
  };

  // Validate clips and send to API
  const handleValidateClips = async () => {
    if (!activeJob) {
      console.warn('No active job');
      return;
    }

    // Check if this is a subsequent sync (sync_key exists)
    const isSubsequentSync = !!activeJob.syncKey;

    if (isSubsequentSync) {
      // Subsequent sync: use minimal payload with just sync_key
      console.log('\n=== Subsequent Incremental Sync ===');
      console.log(`Using sync_key: ${activeJob.syncKey}`);

      const minimalPayload = {
        sync_key: activeJob.syncKey,
        mock: true,
        mock_delay_seconds: 5 // 5 seconds to see progress bar in action
      };

      console.log('Minimal Payload:', JSON.stringify(minimalPayload, null, 2));

      try {
        console.log('\n=== Sending to API (via proxy) ===');
        console.log('POST http://localhost:3000/api/sync/trigger');

        const response = await fetch('http://localhost:3000/api/sync/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(minimalPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error:', response.status, errorText);
          return;
        }

        const result = await response.json();
        console.log('✅ API Response:', result);
        console.log(`Job ID: ${result.job_id}`);
        console.log(`Status: ${result.status}`);
        console.log(`Message: ${result.message}`);

        // Update sync status
        useAppStore.getState().updateSyncStatus(activeJob.id, result.job_id, result.status);

        // Set all destination clips to 'uploading' state with 0 progress
        setDestinationClipsToUploading();

        // Start polling for job status
        if (result.job_id) {
          console.log('\n=== Monitoring Job Progress ===');
          pollJobStatus(result.job_id);
        }
      } catch (error) {
        console.error('❌ Failed to send request:', error);
      }

      return; // Exit early for subsequent sync
    }

    // First sync: build full payload
    console.log('\n=== First Incremental Sync ===');

    // Collect all clips from all groups/aspects/tracks
    const sourceClips: any[] = [];
    const destClips: any[] = [];

    activeJob.groups.forEach(group => {
      group.aspects.forEach(aspect => {
        aspect.tracks.forEach(track => {
          track.clips.forEach(clip => {
            // Filter by clip type
            if (clip.linkType === 'source') {
              sourceClips.push({
                clipId: clip.id,
                clipName: clip.name,
                assetName: group.name || group.assetId || 'Unknown Asset',
                aspectName: aspect.name,
                groupId: group.id,
                aspectId: aspect.id,
                trackId: track.id,
                dataType: clip.dataType || track.dataType,
                unit: clip.unit || track.unit,
                property: track.property,
                absoluteStartTime: clip.absoluteStartTime,
                absoluteEndTime: clip.absoluteEndTime,
              });
            } else if (clip.linkType === 'destination') {
              destClips.push({
                clipId: clip.id,
                clipName: clip.name,
                assetName: group.name || group.assetId || 'Unknown Asset',
                aspectName: aspect.name,
                groupId: group.id,
                aspectId: aspect.id,
                trackId: track.id,
                dataType: clip.dataType || track.dataType,
                unit: clip.unit || track.unit,
                property: track.property,
                absoluteStartTime: clip.absoluteStartTime,
                absoluteEndTime: clip.absoluteEndTime,
                sourceClipId: clip.sourceClipId, // Reference to which source clip this pulls from
              });
            }
          });
        });
      });
    });

    if (sourceClips.length === 0) {
      console.warn('⚠️ No source clips found. Mark clips as Source type first.');
      return;
    }

    if (destClips.length === 0) {
      console.warn('⚠️ No destination clips found. Mark clips as Destination type first.');
      return;
    }

    // Build API payload structure
    const sourceProperties: Record<string, string> = {};
    const destProperties: Record<string, string> = {};
    const schema: Record<string, string> = {};

    // Get source and destination group info
    const sourceGroupId = sourceClips[0]?.groupId;
    const destGroupId = destClips[0]?.groupId;

    const sourceGroup = activeJob.groups.find(g => g.id === sourceGroupId);
    const destGroup = activeJob.groups.find(g => g.id === destGroupId);

    // Look up tenant credentials
    const sourceTenant = tenants.find(t => t.tenantId === sourceGroup?.tenantId);
    const destTenant = tenants.find(t => t.tenantId === destGroup?.tenantId);

    // Build source and destination properties mapping using sourceClipId links
    // The UI allows users to explicitly link destination clips to source clips via sourceClipId
    // Each link creates an "abstract field" that appears in both source and destination properties
    destClips.forEach((destClip) => {
      // Only process destination clips that have a source link
      if (!destClip.sourceClipId || !destClip.property) {
        return;
      }

      // Find the source clip this destination is linked to
      const linkedSourceClip = sourceClips.find(sc => sc.clipId === destClip.sourceClipId);

      if (!linkedSourceClip || !linkedSourceClip.property) {
        console.warn(`⚠️ Destination clip "${destClip.clipName}" is linked to a source clip that doesn't exist or has no property`);
        return;
      }

      // Abstract field name: use the SOURCE property name as the key
      // This is the field name that will appear in the schema
      const abstractField = linkedSourceClip.property;

      // Build source path from SOURCE CLIP: assetId/aspectName/property
      const sourceGroup = activeJob.groups.find(g => g.id === linkedSourceClip.groupId);
      const sourceAssetId = sourceGroup?.assetId || linkedSourceClip.groupId;
      const sourcePath = `${sourceAssetId}/${linkedSourceClip.aspectName}/${linkedSourceClip.property}`;
      sourceProperties[abstractField] = sourcePath;

      // Build destination path from DESTINATION CLIP: assetId/aspectName/property
      const destGroup = activeJob.groups.find(g => g.id === destClip.groupId);
      const destAssetId = destGroup?.assetId || destClip.groupId;
      const destPath = `${destAssetId}/${destClip.aspectName}/${destClip.property}`;
      destProperties[abstractField] = destPath;

      // Add to schema - use source data type (or fall back to destination)
      const dataType = linkedSourceClip.dataType || destClip.dataType;
      if (dataType) {
        // Map Flow Studio data types to API data types
        const typeMap: Record<string, string> = {
          'Double': 'number',
          'Int': 'integer',
          'Long': 'integer',
          'Boolean': 'boolean',
          'String': 'string',
          'Big_string': 'string',
          'Timestamp': 'string'
        };
        schema[abstractField] = typeMap[dataType] || 'string';
      }
    });

    // Get time range from Source Master (first clip in master lane)
    const sourceMaster = activeJob.masterLane?.clips?.[0];
    const sourceStartDate = sourceMaster?.absoluteStartTime ? new Date(sourceMaster.absoluteStartTime) : null;
    const sourceEndDate = sourceMaster?.absoluteEndTime ? new Date(sourceMaster.absoluteEndTime) : null;

    // Get time range from Destination Master (second clip in master lane, only in full sync mode)
    const destMaster = activeJob.masterLane?.clips?.[1];
    const destStartDate = destMaster?.absoluteStartTime ? new Date(destMaster.absoluteStartTime) : null;
    const destEndDate = destMaster?.absoluteEndTime ? new Date(destMaster.absoluteEndTime) : null;

    const formatDateTime = (date: Date | null) => {
      if (!date) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year}, ${hours}:${minutes}`;
    };

    // Calculate timestamp shift if source and destination have different start times
    let transformationConfig: { type: string; target_start_date: string } | undefined = undefined;
    if (sourceStartDate && destStartDate) {
      const timeDiffMs = destStartDate.getTime() - sourceStartDate.getTime();

      // Only add transformation if there's a significant difference (> 1 minute to avoid rounding issues)
      if (Math.abs(timeDiffMs) > 60000) {
        // Use target_start_date format (more explicit than calculating shift_days)
        transformationConfig = {
          type: "timestamp_shift",
          target_start_date: destStartDate.toISOString() // ISO 8601 format: "2026-01-15T00:00:00Z"
        };
      }
    }

    const apiPayload: any = {
      sync_mode: activeJob.syncMode === 'incremental' ? "incremental" : "full",
      source: {
        tenant_id: sourceTenant?.tenantId || sourceGroup?.tenantId || "",
        client_id: sourceTenant?.clientId || "",
        client_secret: sourceTenant?.clientSecret || "",
        region: sourceTenant?.region || "",
        start_date: formatDateTime(sourceStartDate),
        end_date: formatDateTime(sourceEndDate),
        properties: sourceProperties
      },
      destination: {
        tenant_id: destTenant?.tenantId || destGroup?.tenantId || "",
        client_id: destTenant?.clientId || "",
        client_secret: destTenant?.clientSecret || "",
        region: destTenant?.region || "",
        properties: destProperties
      },
      schema: schema,
      mock: true, // Use mock mode for testing
      mock_delay_seconds: 5 // 5 seconds to see progress bar in action
    };

    // Add transformation_config if there's a time shift
    if (transformationConfig) {
      apiPayload.transformation_config = transformationConfig;
    }

    // Validation: Check for destination clips without source links
    const unlinkedDestClips = destClips.filter(dc => !dc.sourceClipId);
    if (unlinkedDestClips.length > 0) {
      console.warn(`\n⚠️ Warning: ${unlinkedDestClips.length} destination clip(s) are not linked to a source clip:`);
      unlinkedDestClips.forEach(clip => {
        console.warn(`  - ${clip.clipName} (${clip.assetName} / ${clip.aspectName} / ${clip.property})`);
      });
      console.warn('These clips will be excluded from the sync. Use the "Src" dropdown on each destination clip to link it to a source clip.\n');
    }

    // Check if we have any valid mappings
    if (Object.keys(sourceProperties).length === 0) {
      console.error('❌ No valid property mappings found. Ensure destination clips are linked to source clips using the "Src" dropdown.');
      return;
    }

    // Output to console
    console.log('=== Airbyte Sync Payload ===');
    console.log(JSON.stringify(apiPayload, null, 2));
    console.log('\n=== Source Clips ===');
    console.log(`Found ${sourceClips.length} source clips`);
    sourceClips.forEach((clip, i) => {
      console.log(`  ${i + 1}. ${clip.assetName} / ${clip.aspectName} / ${clip.property}`);
    });
    console.log('\n=== Destination Clips ===');
    console.log(`Found ${destClips.length} destination clips (${destClips.length - unlinkedDestClips.length} linked, ${unlinkedDestClips.length} unlinked)`);
    destClips.forEach((clip, i) => {
      console.log(`  ${i + 1}. ${clip.assetName} / ${clip.aspectName} / ${clip.property}`);
      if (clip.sourceClipId) {
        const srcClip = sourceClips.find(s => s.clipId === clip.sourceClipId);
        if (srcClip) {
          console.log(`     → Pulls data from: ${srcClip.assetName} / ${srcClip.aspectName} / ${srcClip.property}`);
        } else {
          console.log(`     ⚠️ Linked to unknown source clip ID: ${clip.sourceClipId}`);
        }
      } else {
        console.log(`     ⚠️ Not linked to any source clip`);
      }
    });
    console.log('\n=== Property Mappings ===');
    console.log(`Created ${Object.keys(sourceProperties).length} property mapping(s):`);
    Object.keys(sourceProperties).forEach((key, i) => {
      console.log(`  ${i + 1}. ${key}:`);
      console.log(`     Source:      ${sourceProperties[key]}`);
      console.log(`     Destination: ${destProperties[key]}`);
      console.log(`     Type:        ${schema[key]}`);
    });

    // Output transformation info
    if (transformationConfig) {
      console.log('\n=== Transformation ===');
      console.log(`Type: ${transformationConfig.type}`);
      console.log(`Target Start Date: ${transformationConfig.target_start_date}`);
      console.log(`Source Start:      ${formatDateTime(sourceStartDate)}`);
      console.log(`Destination Start: ${formatDateTime(destStartDate)}`);

      // Calculate shift for informational purposes
      if (sourceStartDate && destStartDate) {
        const timeDiffMs = destStartDate.getTime() - sourceStartDate.getTime();
        const timeDiffDays = Math.round((timeDiffMs / (1000 * 60 * 60 * 24)) * 100) / 100;
        if (timeDiffDays > 0) {
          console.log(`→ Source data will be shifted ${timeDiffDays} days FORWARD to reach destination time`);
        } else {
          console.log(`→ Source data will be shifted ${Math.abs(timeDiffDays)} days BACKWARD to reach destination time`);
        }
      }
    } else {
      console.log('\n=== Transformation ===');
      console.log('No time shift required (source and destination have the same start time)');
    }

    // Send to API via backend proxy
    try {
      console.log('\n=== Sending to API (via proxy) ===');
      console.log('POST http://localhost:3000/api/sync/trigger');

      const response = await fetch('http://localhost:3000/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        return;
      }

      const result = await response.json();
      console.log('✅ API Response:', result);
      console.log(`Job ID: ${result.job_id}`);
      console.log(`Status: ${result.status}`);
      console.log(`Message: ${result.message}`);

      if (result.sync_key) {
        console.log(`Sync Key: ${result.sync_key}`);
        console.log('💾 Saving sync_key for future incremental syncs');
        // Store sync_key in the job for subsequent syncs
        useAppStore.getState().setSyncKey(activeJob.id, result.sync_key);
      }

      // Update sync status
      useAppStore.getState().updateSyncStatus(activeJob.id, result.job_id, result.status);

      // Set all destination clips to 'uploading' state with 0 progress
      setDestinationClipsToUploading();

      // Start polling for job status
      if (result.job_id) {
        console.log('\n=== Monitoring Job Progress ===');
        pollJobStatus(result.job_id);
      }
    } catch (error) {
      console.error('❌ Failed to send request:', error);
    }
  };

  // Poll job status from API via backend proxy
  const pollJobStatus = async (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // Poll for up to 60 seconds
    const pollInterval = 1000; // Poll every second

    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/sync/status/${jobId}`);

        if (!response.ok) {
          console.error(`❌ Failed to get job status: ${response.status}`);
          return;
        }

        const status = await response.json();

        console.log(`[${new Date().toLocaleTimeString()}] Job ${jobId}:`);
        console.log(`  Status: ${status.status}`);
        if (status.records_extracted !== null && status.records_extracted !== undefined) {
          console.log(`  Records Extracted: ${status.records_extracted}`);
        }
        if (status.records_loaded !== null && status.records_loaded !== undefined) {
          console.log(`  Records Loaded: ${status.records_loaded}`);
        }
        if (status.error) {
          console.log(`  Error: ${status.error}`);
        }

        // Update status in store
        if (activeJobId) {
          useAppStore.getState().updateSyncStatus(activeJobId, jobId, status.status);
        }

        // Calculate and update clip progress
        if (status.status === 'running' || status.status === 'completed') {
          let progressPercent = 0;

          // Calculate progress based on records loaded vs extracted
          if (status.records_extracted && status.records_extracted > 0) {
            const loaded = status.records_loaded || 0;
            progressPercent = Math.min(100, Math.round((loaded / status.records_extracted) * 100));
          } else if (status.status === 'completed') {
            progressPercent = 100;
          }

          // Update clip states based on job status
          if (status.status === 'completed') {
            // When sync completes, set lastSyncedTime to now and update progress
            const now = new Date().toISOString();
            updateDestinationClipsProgressWithTimestamp(progressPercent, 'complete', now);
          } else {
            // Show as uploading for first 50%, processing for 50-100%
            const clipState = progressPercent < 50 ? 'uploading' : 'processing';
            updateDestinationClipsProgress(progressPercent, clipState);
          }
        }

        // Continue polling if job is still running
        if (status.status === 'pending' || status.status === 'running') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            console.log('⏱️ Max polling attempts reached');
            // Set clips to error state if polling times out
            updateDestinationClipsProgress(0, 'error');
          }
        } else {
          // Job completed
          if (status.status === 'completed') {
            console.log('✅ Job completed successfully!');
            updateDestinationClipsProgress(100, 'complete');
          } else if (status.status === 'failed') {
            console.log('❌ Job failed!');
            updateDestinationClipsProgress(0, 'error');
          }
          console.log(`Started at: ${status.started_at}`);
          console.log(`Completed at: ${status.completed_at}`);
        }
      } catch (error) {
        console.error('❌ Error polling job status:', error);
      }
    };

    // Start polling
    poll();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete selected clips
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.clipIds.size > 0) {
        e.preventDefault();
        removeSelectedClips();
      }

      // Copy clips
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection.clipIds.size > 0) {
        e.preventDefault();
        copySelection();
      }

      // Cut clips
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && selection.clipIds.size > 0) {
        e.preventDefault();
        cut();
      }

      // Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        useAppStore.getState().selectAll();
      }

      // Escape to clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
      }

      // Zoom to fit selected clips (Z key - like Propellerhead Reason)
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey && selection.clipIds.size > 0) {
        e.preventDefault();

        // Get all selected clips
        const selectedClips = useAppStore.getState().getSelectedClips();
        if (selectedClips.length === 0) return;

        // Find the time range that encompasses all selected clips
        let minStart = Infinity;
        let maxEnd = -Infinity;

        selectedClips.forEach(clip => {
          minStart = Math.min(minStart, clip.timeRange.start);
          maxEnd = Math.max(maxEnd, clip.timeRange.end);
        });

        // Add 10% padding on each side for better visibility
        const duration = maxEnd - minStart;
        const padding = duration * 0.1;
        const viewportStart = Math.max(0, minStart - padding);
        const viewportDuration = Math.min(timeline.duration - viewportStart, duration + (padding * 2));

        // Calculate and set the zoom FIRST (before setViewport)
        const timelineContainer = document.querySelector('.hide-scrollbar') as HTMLElement;
        // timelineContainer.clientWidth is already after VisibilityTree, just subtract track header
        const availableWidth = (timelineContainer?.clientWidth || 1200) - trackHeaderWidth;
        const newZoom = availableWidth / viewportDuration;
        useAppStore.getState().setZoom(Math.max(0.001, Math.min(200, newZoom)));

        // Now update Navigator viewport
        useAppStore.getState().setViewport(viewportStart, viewportDuration);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection.clipIds, removeSelectedClips, copySelection, cut, clearSelection, timeline.duration]);

  // Sync DOM scroll position when store scrollX changes (from Navigator)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Only update DOM if it's different from store value
    // This prevents infinite loops (scroll event → setScroll → this effect → scroll event)
    if (Math.abs(container.scrollLeft - timeline.scrollX) > 1) {
      container.scrollLeft = timeline.scrollX;
    }
  }, [timeline.scrollX]);

  // Recalculate zoom when viewport duration, container width, or track header width changes
  useEffect(() => {
    // Wait for ResizeObserver to set containerWidth before calculating zoom
    if (containerWidth === null) return;

    // Calculate available width for timeline content (container minus track headers)
    const availableWidth = containerWidth - trackHeaderWidth;
    const newZoom = availableWidth / timeline.viewportDuration;
    // Allow very low zoom for large time ranges (0.0001 = 10000 seconds per pixel = ~2.7 hours/px)
    // Max 200 pixels/second for extreme zoom in
    const clampedZoom = Math.max(0.0001, Math.min(200, newZoom));

    setZoom(clampedZoom);
  }, [timeline.viewportDuration, containerWidth, trackHeaderWidth, setZoom]);

  // Track container width and recalculate zoom when it changes
  useEffect(() => {
    const timelineContainer = scrollContainerRef.current;
    if (!timelineContainer) return;

    // Create a ResizeObserver to detect when available width changes (panels opening/closing, window resize)
    const resizeObserver = new ResizeObserver(() => {
      const newContainerWidth = timelineContainer.clientWidth;
      // Update container width state - this will trigger the useEffect that recalculates zoom
      setContainerWidth(newContainerWidth);
    });

    resizeObserver.observe(timelineContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // No dependencies - observer only needs to track container width changes

  return (
    <div className="flex flex-col h-full bg-timeline-bg">
      {/* Timeline header with controls */}
      <div className="flex items-center justify-between p-2 bg-gray-900 border-b border-gray-700 gap-4">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-200 flex-shrink-0">Timeline</h2>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <label className="flex items-center text-sm text-gray-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={timeline.gridSnap}
                onChange={() => useAppStore.getState().toggleGridSnap()}
                className="mr-2"
              />
              Snap to Grid
            </label>
          </div>

          {/* Position sync toggle - DORMANT (keeping for potential future use) */}
          {/* Flexible links are dormant in favor of Source/Destination masters */}
          {false && activeJob && (
            <div className="flex items-center space-x-2 flex-shrink-0 border-l border-gray-700 pl-2">
              <label className="flex items-center text-sm text-gray-400 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={activeJob.syncLinkedClipPositions}
                  onChange={() => toggleSyncLinkedClipPositions(activeJob.id)}
                  className="mr-2"
                />
                <span title="When enabled, all linked clips share the same start time">
                  Lock Linked Positions
                </span>
              </label>
            </div>
          )}

          {/* View mode toggles */}
          <div className="flex items-center gap-1 flex-shrink-0 border-l border-gray-700 pl-2">
            <button
              onClick={toggleShowAssets}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showAssets
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={showAssets ? 'Hide Asset Groups' : 'Show Asset Groups'}
            >
              Assets
            </button>
            <button
              onClick={toggleShowAspects}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showAspects
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={showAspects ? 'Hide Aspect Groups' : 'Show Aspect Groups'}
            >
              Aspects
            </button>
            <button
              onClick={toggleShowClipsOnly}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showClipsOnly
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={showClipsOnly ? 'Show All Tracks' : 'Show Only Tracks With Clips'}
            >
              Clips
            </button>

            {/* Sync Mode Toggle */}
            {activeJob && (
              <button
                onClick={() => {
                  const newMode = activeJob.syncMode === 'full' ? 'incremental' : 'full';
                  setSyncMode(activeJob.id, newMode);
                }}
                className={`px-2 py-1 text-xs rounded transition-colors border ${
                  activeJob.syncMode === 'full'
                    ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-500'
                    : 'bg-green-600 text-white hover:bg-green-700 border-green-500'
                }`}
                title={`Switch to ${activeJob.syncMode === 'full' ? 'Incremental (Live)' : 'Full Refresh'} mode`}
              >
                {activeJob.syncMode === 'full' ? '⟳ Full' : '⚡ Live'}
              </button>
            )}

            <button
              onClick={toggleShowSource}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showSource
                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={showSource ? 'Hide Master Lane' : 'Show Master Lane'}
            >
              Master
            </button>
          </div>

          <div className="text-sm text-gray-400 truncate">
            Playhead: {formatTime(timeline.playheadPosition)}
          </div>

          {/* Panel visibility toggles */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={toggleInspector}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                inspectorVisible
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={inspectorVisible ? 'Hide Inspector' : 'Show Inspector'}
            >
              Inspector
            </button>
            <button
              onClick={toggleJobQueue}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                jobQueueVisible
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={jobQueueVisible ? 'Hide Job Queue' : 'Show Job Queue'}
            >
              Jobs
            </button>
            <button
              onClick={toggleSettings}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                settingsVisible
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
              title={settingsVisible ? 'Hide Settings' : 'Show Settings'}
            >
              Settings
            </button>
            <button
              onClick={handleValidateClips}
              className="px-2 py-1 text-xs rounded transition-colors bg-blue-700 text-gray-200 hover:bg-blue-600"
              title={activeJob?.syncKey
                ? "Run subsequent incremental sync using saved sync_key"
                : "Validate clips and trigger first sync (will generate sync_key)"
              }
            >
              {activeJob?.syncKey ? '⚡ Sync Again' : 'Validate Clips'}
            </button>

            {/* Sync Key Indicator */}
            {activeJob?.syncKey && (
              <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
                <span className="text-[10px] text-green-400 flex items-center gap-1" title={`Sync Key: ${activeJob.syncKey}`}>
                  🔑 Incremental
                </span>
                {activeJob.lastSyncStatus && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    activeJob.lastSyncStatus === 'completed' ? 'bg-green-900/50 text-green-300' :
                    activeJob.lastSyncStatus === 'failed' ? 'bg-red-900/50 text-red-300' :
                    activeJob.lastSyncStatus === 'running' ? 'bg-blue-900/50 text-blue-300' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {activeJob.lastSyncStatus}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (confirm('Reset incremental sync?\n\nThis will clear the sync_key and the next sync will be treated as a first sync (full payload).')) {
                      useAppStore.getState().clearSyncKey(activeJob.id);
                    }
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 hover:bg-red-700 hover:text-white transition-colors"
                  title="Clear sync_key and reset incremental sync"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date range picker - fixed on right */}
        <div className="flex-shrink-0">
          <DateRangePicker />
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Visibility Tree Sidebar */}
        <VisibilityTree />

        {/* Right side: Scrollable timeline + Navigator */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable timeline area - scrollbar hidden via CSS */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto hide-scrollbar bg-timeline-bg"
            onScroll={handleScroll}
          >
            {/* Time ruler */}
            <div className="sticky top-0 z-40 bg-timeline-bg border-b border-gray-700">
              {/* Actual time ruler that scrolls - full width */}
              <div
                className="h-14 bg-gray-800 cursor-pointer"
                style={{ width: `${timelineWidth}px` }}
                onClick={handleTimelineClick}
                onDoubleClick={handleTimelineClick}
              >
                {generateTimeMarkers()}
              </div>
            </div>

            {/* Sticky track header spacer - SEPARATE, overlays time ruler */}
            <div
              className="bg-gray-900 border-r border-gray-700 h-14"
              style={{
                width: `${trackHeaderWidth}px`,
                position: 'sticky',
                top: 0,
                left: 0,
                marginTop: '-56px', // Pull up to overlay time ruler (h-14 = 56px)
                zIndex: 50
              }}
            >
              {/* Resize handle - draggable vertical bar */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50 transition-colors ${
                  isDraggingHeaderResize ? 'bg-blue-500' : 'hover:bg-blue-400 bg-transparent'
                }`}
                onMouseDown={handleHeaderResizeMouseDown}
                title="Drag to resize track headers"
              />
            </div>

            {/* Tracks container */}
            <div
              ref={timelineRef}
              className="relative"
              style={{ width: `${timelineWidth}px` }}
              data-timeline-container="true"
            >
              {/* Playhead */}
              <motion.div
                className={`absolute top-0 bottom-0 w-0.5 pointer-events-none ${
                  isDraggingPlayhead ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{
                  left: `${timeline.playheadPosition * timeline.zoom + trackHeaderWidth}px`,
                  zIndex: 60  // Higher than sticky spacer (50) to appear above timeline header
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {/* Playhead handle */}
                <div
                  className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500 cursor-ew-resize pointer-events-auto"
                  data-playhead-handle="true"
                  onMouseDown={handlePlayheadMouseDown}
                />
              </motion.div>

              {/* Master Lane - Single track for source/destination clips */}
              {activeJob && activeJob.masterLane && showSource && (
                <SpecialLane
                  laneType="master"
                  masterClips={activeJob.masterLane.clips}
                  trackIndex={0}
                  zoom={timeline.zoom}
                  width={timelineWidth - trackHeaderWidth}
                  syncMode={activeJob.syncMode}
                />
              )}

              {/* Groups with tracks - filter by visibility */}
              {groups
                .filter(group => group.visible) // Only render visible groups
                .sort((a, b) => a.index - b.index)
                .map((group, index) => {
                  // Calculate track offset for this group based on:
                  // 1. Special lanes (Source and/or Destination)
                  // 2. All previous VISIBLE groups
                  let trackOffset = 0;

                  // Add offset for special lanes
                  if (activeJob) {
                    if (showSource) trackOffset++;
                    if (showDestination) trackOffset++;
                  }

                  // Add offset for previous groups
                  const visibleGroups = groups.filter(g => g.visible).sort((a, b) => a.index - b.index);
                  for (let i = 0; i < index; i++) {
                    const prevGroup = visibleGroups[i];
                    for (const aspect of prevGroup.aspects) {
                      if (aspect.visible) { // Only count visible aspects
                        trackOffset += aspect.tracks.filter(t => t.visible).length; // Only count visible tracks
                      }
                    }
                  }

                  return (
                    <Group
                      key={group.id}
                      group={group}
                      trackOffset={trackOffset}
                      zoom={timeline.zoom}
                      width={timelineWidth}
                      onClipDrop={(trackId, time) => {
                        // Handle clip drop from clipboard
                        paste(trackId, time);
                      }}
                    />
                  );
                })}

              {/* Ghost clips preview when copying - supports multiple for multi-select */}
              {ghostClips.map((ghost) => (
                <GhostClip
                  key={ghost.clipId}
                  left={ghost.left}
                  width={ghost.width}
                  top={ghost.top}
                  isIncompatible={ghost.isIncompatible}
                />
              ))}

              {/* Selection overlay for rectangular marquee selection */}
              <SelectionOverlay containerRef={timelineRef} />

              {/* Snap indicator - shows vertical line when clips align */}
              <SnapIndicator position={snapIndicatorPosition} zoom={timeline.zoom} trackHeaderWidth={trackHeaderWidth} />
            </div>
          </div>

          {/* Navigator bar - aligned with tracks area only, not under sidebar */}
          <div className="flex">
            {/* Spacer to match track headers width */}
            <div className="flex-shrink-0" style={{ width: `${trackHeaderWidth}px` }} />
            {/* Navigator */}
            <div className="flex-1">
              <Navigator />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};