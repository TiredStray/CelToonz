import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Clapperboard, FileUp, Loader2, X } from 'lucide-react';
import {
  CANVAS_PRESETS,
  CanvasPreset,
  CineGridParseResult,
  Project,
} from '../types/animation';
import {
  buildProjectFromCineGrid,
  createSampleCineGridJson,
  parseCineGridJson,
} from '../utils/cinegridImport';

interface CineGridImportModalProps {
  open: boolean;
  initialParsed?: CineGridParseResult | null;
  onClose: () => void;
  onImported: (project: Project, summaryText: string) => void;
}

export const CineGridImportModal: React.FC<CineGridImportModalProps> = ({
  open,
  initialParsed = null,
  onClose,
  onImported,
}) => {
  const [parsed, setParsed] = useState<CineGridParseResult | null>(initialParsed);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<CanvasPreset>(CANVAS_PRESETS[0]);
  const [defaultHold, setDefaultHold] = useState(4);
  const [refOpacity, setRefOpacity] = useState(0.45);
  const [isBuilding, setIsBuilding] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setIsBuilding(false);
      return;
    }
    if (initialParsed) {
      applyParsedResult(initialParsed);
    } else {
      setParsed(null);
    }
  }, [open, initialParsed]);

  const applyParsedResult = (res: CineGridParseResult) => {
    setParsed(res);
    setProjectTitle(res.title);
    setErrorMsg(null);

    if (res.aspectRatioHint?.includes('1:1')) {
      setSelectedPreset(CANVAS_PRESETS[1]);
    } else if (res.aspectRatioHint?.includes('9:16')) {
      setSelectedPreset(CANVAS_PRESETS[2]);
    } else {
      setSelectedPreset(CANVAS_PRESETS[0]);
    }
  };

  const handleJsonText = (rawText: string) => {
    try {
      const res = parseCineGridJson(rawText);
      applyParsedResult(res);
    } catch (err) {
      setParsed(null);
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to parse Hotshots storyboard JSON.'
      );
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    handleJsonText(text);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleJsonText(text);
  };

  // Group parsed panels by shotId for structured Shot -> SubShot preview
  const groupedShots = useMemo(() => {
    if (!parsed) return [];
    const map = new Map<
      string,
      {
        shotId: string;
        shotNumber: string;
        shotTitle: string;
        items: CineGridParseResult['panels'];
      }
    >();
    for (const p of parsed.panels) {
      const existing = map.get(p.shotId);
      if (existing) {
        existing.items.push(p);
      } else {
        map.set(p.shotId, {
          shotId: p.shotId,
          shotNumber: p.shotNumber,
          shotTitle: p.shotTitle,
          items: [p],
        });
      }
    }
    return Array.from(map.values());
  }, [parsed]);

  if (!open) return null;

  const handleConfirmImport = async () => {
    if (!parsed) return;
    setIsBuilding(true);
    setErrorMsg(null);
    try {
      const proj = await buildProjectFromCineGrid(parsed, {
        title: projectTitle || parsed.title,
        width: selectedPreset.width,
        height: selectedPreset.height,
        backgroundColor: '#FAF9F6',
        defaultHoldFrames: defaultHold,
        refLayerOpacity: refOpacity,
      });
      onImported(
        proj,
        `Imported ${parsed.shotCount} Shots (${parsed.panels.length} timeline panels)`
      );
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to build timeline from storyboard.'
      );
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFilePick}
        className="hidden"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import Hotshots JSON"
        className="w-full max-w-2xl bg-[#1D1D21] border border-[#32323A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#32323A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Clapperboard className="w-5 h-5 text-[#F59E0B]" />
            <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
              Import Hotshots JSON
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Hotshots import modal"
            className="min-w-[40px] min-h-[40px] -mr-2 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#26262C] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto studio-scroll">
          {!parsed ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border border-dashed border-[#3F3F46] hover:border-[#F59E0B]/60 rounded-xl p-6 text-center bg-[#141417] space-y-4 transition-colors"
            >
              <FileUp className="w-8 h-8 text-[#F59E0B] mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#F4F4F6]">
                  Drop your Hotshots storyboard .json file here
                </p>
                <p className="text-xs text-[#A1A1AA]">
                  Imports all Shots and SubShots onto a locked reference layer underneath Rough Sketch and Clean Ink.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] text-[#141417] text-xs font-semibold cursor-pointer"
                >
                  Choose Hotshots JSON
                </button>
                <button
                  type="button"
                  onClick={() => handleJsonText(createSampleCineGridJson())}
                  className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-[#E4E4E7] text-xs font-medium cursor-pointer"
                >
                  Try Sample Storyboard
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary & Change File */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#32323A]">
                <div>
                  <div className="text-xs text-[#A1A1AA]">Detected Storyboard Structure</div>
                  <div className="text-sm font-mono-tabular font-medium text-[#F4F4F6] mt-0.5">
                    {parsed.shotCount} Shots · {parsed.panels.length} Timeline Panels
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-h-[36px] px-3 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] cursor-pointer"
                >
                  Replace JSON File
                </button>
              </div>

              {/* Import Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="cg-title"
                    className="block text-xs font-medium text-[#A1A1AA] mb-1.5"
                  >
                    Project Title
                  </label>
                  <input
                    id="cg-title"
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[#141417] border border-[#32323A] focus:border-[#F59E0B] focus:outline-none text-xs text-[#F4F4F6]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                    Canvas Size
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CANVAS_PRESETS.map((preset) => {
                      const active = selectedPreset.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPreset(preset)}
                          className={`h-9 rounded-lg border text-xs font-mono-tabular transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#26262C] border-[#F59E0B] text-[#F59E0B]'
                              : 'bg-[#141417] border-[#32323A] text-[#A1A1AA]'
                          }`}
                        >
                          {preset.ratioLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[#A1A1AA]">
                      Default Panel Hold
                    </span>
                    <span className="text-xs font-mono-tabular text-[#F4F4F6]">
                      {defaultHold}f ({(defaultHold / 24).toFixed(2)}s)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={defaultHold}
                    onChange={(e) => setDefaultHold(Number(e.target.value))}
                    className="w-full studio-range"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[#A1A1AA]">
                      Reference Layer Opacity
                    </span>
                    <span className="text-xs font-mono-tabular text-[#F4F4F6]">
                      {Math.round(refOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={100}
                    value={Math.round(refOpacity * 100)}
                    onChange={(e) => setRefOpacity(Number(e.target.value) / 100)}
                    className="w-full studio-range"
                  />
                </div>
              </div>

              {/* Shots & SubShots Breakdown Preview */}
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[#A1A1AA]">
                  Shots & SubShots Mapping Preview
                </div>
                <div className="max-h-56 overflow-y-auto studio-scroll border border-[#32323A] rounded-xl divide-y divide-[#2A2A32] bg-[#141417]">
                  {groupedShots.map((group) => (
                    <div key={group.shotId} className="p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#F59E0B] font-mono-tabular">
                          {group.shotNumber}{' '}
                          <span className="font-sans text-[#F4F4F6] font-medium ml-1">
                            {group.shotTitle}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[#71717A]">
                          {group.items.length} {group.items.length === 1 ? 'panel' : 'subshots'}
                        </span>
                      </div>

                      <div className="space-y-1.5 pl-3 border-l border-[#32323A]">
                        {group.items.map((sub, idx) => (
                          <div
                            key={`${group.shotId}-${idx}`}
                            className="flex items-center gap-3 text-xs py-1"
                          >
                            {sub.imageSrc ? (
                              <img
                                src={sub.imageSrc}
                                alt={sub.subShotTitle || sub.shotTitle}
                                referrerPolicy="no-referrer"
                                className="w-14 h-8 rounded object-cover bg-[#FAF9F6] border border-[#32323A] shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-8 rounded bg-[#26262C] border border-[#32323A] flex items-center justify-center text-[10px] font-mono-tabular text-[#A1A1AA] shrink-0">
                                Guide
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[#E4E4E7] font-medium truncate">
                                <span className="font-mono-tabular text-[#38BDF8] mr-1.5">
                                  {sub.subShotNumber ?? group.shotNumber}
                                </span>
                                {sub.subShotTitle || sub.camera || sub.shotTitle}
                              </div>
                              {sub.notes && (
                                <div className="text-[11px] text-[#71717A] truncate">
                                  {sub.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#32323A] bg-[#19191D] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#26262C] hover:bg-[#32323A] text-xs font-medium text-[#E4E4E7] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsed || isBuilding}
            onClick={handleConfirmImport}
            className="min-h-[44px] md:min-h-[38px] px-4 rounded-lg bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-40 text-[#141417] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {isBuilding && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Import to Timeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
