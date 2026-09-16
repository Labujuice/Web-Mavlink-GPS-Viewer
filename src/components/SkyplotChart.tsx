import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { SatelliteInfo } from '../types/mavlink';
import { Splitter } from './Splitter';

interface SkyplotChartProps {
  satellites: SatelliteInfo[];
  themeMode?: 'day' | 'night';
}

export const SkyplotChart: React.FC<SkyplotChartProps> = ({ satellites, themeMode = 'night' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const polarRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const polarChartRef = useRef<echarts.ECharts | null>(null);
  const barChartRef = useRef<echarts.ECharts | null>(null);

  const [splitPercent, setSplitPercent] = useState<number>(() => {
    const saved = localStorage.getItem('mav_skyplot_split');
    return saved ? Number(saved) : 55;
  });

  const [snrSortBy, setSnrSortBy] = useState<'prn' | 'snr'>(() => {
    const saved = localStorage.getItem('mav_snr_sort');
    return saved === 'snr' ? 'snr' : 'prn';
  });

  const handleSortChange = (mode: 'prn' | 'snr') => {
    setSnrSortBy(mode);
    localStorage.setItem('mav_snr_sort', mode);
  };

  // Initialize ECharts instances
  useEffect(() => {
    if (polarRef.current) {
      polarChartRef.current = echarts.init(polarRef.current);
    }
    if (barRef.current) {
      barChartRef.current = echarts.init(barRef.current);
    }

    const handleResize = () => {
      polarChartRef.current?.resize();
      barChartRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      polarChartRef.current?.resize();
      barChartRef.current?.resize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      polarChartRef.current?.dispose();
      barChartRef.current?.dispose();
    };
  }, []);

  const handleSplitDrag = (deltaPx: number) => {
    if (!containerRef.current) return;
    const totalHeight = containerRef.current.clientHeight;
    if (totalHeight <= 0) return;
    const deltaPercent = (deltaPx / totalHeight) * 100;
    setSplitPercent((prev) => {
      const next = Math.max(25, Math.min(75, Math.round((prev + deltaPercent) * 10) / 10));
      localStorage.setItem('mav_skyplot_split', String(next));
      return next;
    });
    // Trigger charts resize during drag
    polarChartRef.current?.resize();
    barChartRef.current?.resize();
  };

  // Update Polar Skyplot
  useEffect(() => {
    if (!polarChartRef.current) return;

    // Filter valid satellites with elevation > 0
    const validSats = satellites.filter((s) => s.prn > 0 && s.elevation >= 0);

    const usedData = validSats
      .filter((s) => s.used)
      .map((s) => [s.elevation, s.azimuth, s.prn, s.snr]);

    const unusedData = validSats
      .filter((s) => !s.used)
      .map((s) => [s.elevation, s.azimuth, s.prn, s.snr]);

    const isDay = themeMode === 'day';
    const bgColor = isDay ? '#ffffff' : '#000000';
    const textColor = isDay ? '#000000' : '#00ff66';
    const dimColor = isDay ? '#52525b' : '#15803d';
    const borderColor = isDay ? '#000000' : '#00ff66';
    const axisLineColor = isDay ? '#000000' : '#14331a';
    const splitLineColor = isDay ? '#e2e8f0' : '#102815';

    const option: echarts.EChartsOption = {
      backgroundColor: bgColor,
      title: {
        text: 'CONSTELLATION SKYPLOT (AZ / EL)',
        left: 10,
        top: 8,
        textStyle: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        },
      },
      polar: {
        center: ['50%', '54%'],
        radius: '75%',
      },
      tooltip: {
        backgroundColor: isDay ? '#ffffff' : '#050805',
        borderColor: borderColor,
        textStyle: { color: textColor, fontFamily: 'monospace', fontSize: 11 },
        formatter: (params: any) => {
          const [el, az, prn, snr] = params.data;
          const status = params.seriesName;
          return `<b>PRN #${prn}</b> [${status}]<br/>Elevation: ${el}°<br/>Azimuth: ${az}°<br/>SNR: ${snr} dB-Hz`;
        },
      },
      angleAxis: {
        type: 'value',
        min: 0,
        max: 360,
        startAngle: 90, // 0 deg is North (top)
        clockwise: true,
        interval: 45,
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: {
          color: textColor,
          fontFamily: 'monospace',
          fontSize: 10,
          formatter: (val: number) => {
            if (val === 0 || val === 360) return 'N (0°)';
            if (val === 90) return 'E (90°)';
            if (val === 180) return 'S (180°)';
            if (val === 270) return 'W (270°)';
            return `${val}°`;
          },
        },
      },
      radiusAxis: {
        min: 0,
        max: 90,
        inverse: true, // 90 deg zenith at center, 0 deg horizon at edge
        interval: 30,
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: isDay ? '#e2e8f0' : '#14331a' } },
        axisLabel: {
          color: dimColor,
          fontFamily: 'monospace',
          fontSize: 9,
          formatter: '{value}°',
        },
      },
      series: [
        {
          name: 'USED',
          type: 'scatter',
          coordinateSystem: 'polar',
          data: usedData,
          symbolSize: 22,
          itemStyle: {
            color: isDay ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 255, 102, 0.25)',
            borderColor: borderColor,
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: (params: any) => `${params.data[2]}`,
            color: textColor,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            fontSize: 9,
          },
        },
        {
          name: 'UNUSED',
          type: 'scatter',
          coordinateSystem: 'polar',
          data: unusedData,
          symbolSize: 20,
          itemStyle: {
            color: 'transparent',
            borderColor: isDay ? '#71717a' : '#15803d',
            borderWidth: 1,
            borderType: 'dashed',
          },
          label: {
            show: true,
            formatter: (params: any) => `${params.data[2]}`,
            color: dimColor,
            fontFamily: 'monospace',
            fontSize: 9,
          },
        },
      ],
    };

    polarChartRef.current.setOption(option);
  }, [satellites, themeMode]);

  // Update SNR Bar Chart
  useEffect(() => {
    if (!barChartRef.current) return;

    const isDay = themeMode === 'day';
    const bgColor = isDay ? '#ffffff' : '#000000';
    const textColor = isDay ? '#000000' : '#00ff66';
    const dimColor = isDay ? '#52525b' : '#15803d';
    const axisLineColor = isDay ? '#000000' : '#1b3d22';
    const splitLineColor = isDay ? '#e2e8f0' : '#0f2214';

    let validSats = satellites.filter((s) => s.prn > 0);
    if (snrSortBy === 'snr') {
      // Sort by SNR strength descending (highest SNR first); if equal, sort by PRN
      validSats = [...validSats].sort((a, b) => b.snr - a.snr || a.prn - b.prn);
    } else {
      // Sort by PRN ascending
      validSats = [...validSats].sort((a, b) => a.prn - b.prn);
    }

    const prnLabels = validSats.map((s) => `#${s.prn}`);
    const snrValues = validSats.map((s) => ({
      value: s.snr,
      itemStyle: {
        color: s.used
          ? (isDay ? '#000000' : 'rgba(0, 255, 102, 0.7)')
          : (isDay ? '#a1a1aa' : 'rgba(21, 128, 61, 0.4)'),
        borderColor: s.used
          ? (isDay ? '#000000' : '#00ff66')
          : (isDay ? '#71717a' : '#15803d'),
        borderWidth: 1,
      },
    }));

    const barOption: echarts.EChartsOption = {
      backgroundColor: bgColor,
      title: {
        text: `CARRIER-TO-NOISE (${snrSortBy === 'snr' ? 'BY SNR' : 'BY PRN'})`,
        left: 10,
        top: 8,
        textStyle: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        },
      },
      grid: {
        top: 36,
        left: 35,
        right: 15,
        bottom: 25,
      },
      tooltip: {
        backgroundColor: isDay ? '#ffffff' : '#050805',
        borderColor: isDay ? '#000000' : '#00ff66',
        textStyle: { color: textColor, fontFamily: 'monospace', fontSize: 11 },
        formatter: (params: any) => {
          const sat = validSats[params.dataIndex];
          const statusText = sat?.used
            ? `<span style="color:${isDay ? '#000000' : '#00ff66'};font-weight:bold;">USED</span>`
            : '<span style="color:#71717a;">UNUSED</span>';
          return `PRN: ${params.name}<br/>SNR: ${params.value} dB-Hz<br/>Status: ${statusText}`;
        },
      },
      xAxis: {
        type: 'category',
        data: prnLabels,
        axisLine: { lineStyle: { color: axisLineColor } },
        axisLabel: {
          color: textColor,
          fontFamily: 'monospace',
          fontSize: 9,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 60,
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { lineStyle: { color: splitLineColor, type: 'dashed' } },
        axisLabel: {
          color: dimColor,
          fontFamily: 'monospace',
          fontSize: 9,
        },
      },
      series: [
        {
          name: 'SNR',
          type: 'bar',
          barWidth: '60%',
          data: snrValues,
        },
      ],
    };

    barChartRef.current.setOption(barOption);
  }, [satellites, snrSortBy, themeMode]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-cyber-black border border-cyber-border corner-box overflow-hidden"
    >
      {/* Skyplot Polar Chart */}
      <div
        style={{ height: `${splitPercent}%` }}
        className="min-h-[100px] w-full relative overflow-hidden"
        ref={polarRef}
      />

      {/* Resizable Divider */}
      <Splitter
        direction="horizontal"
        onDrag={handleSplitDrag}
        onDoubleClick={() => {
          setSplitPercent(55);
          localStorage.setItem('mav_skyplot_split', '55');
          polarChartRef.current?.resize();
          barChartRef.current?.resize();
        }}
        title="拖曳調整星空圖與SNR比例，雙擊重設"
      />

      {/* SNR Bar Chart Container */}
      <div
        style={{ height: `calc(${100 - splitPercent}% - 8px)` }}
        className="min-h-[90px] w-full relative overflow-hidden flex flex-col"
      >
        {/* Sort Switcher Controls in top-right */}
        <div className="absolute top-1.5 right-2 z-10 flex items-center gap-1 font-mono text-[10px] select-none bg-black/80 px-1.5 py-0.5 border border-cyber-border/80">
          <span className="text-cyber-muted text-[9px] mr-0.5 hidden sm:inline">SORT:</span>
          <button
            onClick={() => handleSortChange('prn')}
            className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
              snrSortBy === 'prn'
                ? 'border-cyber-line text-cyber-line bg-cyber-line/20 font-bold'
                : 'border-transparent text-cyber-muted hover:text-cyber-line'
            }`}
            title="依照衛星 PRN 編號順序排列 (PRN 1 -> 32...)"
          >
            # PRN
          </button>
          <span className="text-cyber-border">|</span>
          <button
            onClick={() => handleSortChange('snr')}
            className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
              snrSortBy === 'snr'
                ? 'border-cyber-line text-cyber-line bg-cyber-line/20 font-bold'
                : 'border-transparent text-cyber-muted hover:text-cyber-line'
            }`}
            title="依照訊號 SNR 強度降序排列 (高至低)"
          >
            SNR 📶
          </button>
        </div>

        <div className="w-full h-full" ref={barRef} />
      </div>
    </div>
  );
};
