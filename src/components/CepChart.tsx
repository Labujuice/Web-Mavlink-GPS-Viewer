import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { TrajectoryPoint, CepStats } from '../types/mavlink';
import { wgs84ToEnu } from '../utils/geo';
import { Target, RotateCcw } from 'lucide-react';

interface CepChartProps {
  points: TrajectoryPoint[];
  cepStats: CepStats;
  onResetCep: () => void;
  manualRefCoord: { lat: number; lon: number } | null;
  onSetManualRef: (coord: { lat: number; lon: number } | null) => void;
}

export const CepChart: React.FC<CepChartProps> = ({
  points,
  cepStats,
  onResetCep,
  manualRefCoord,
  onSetManualRef,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const echartsInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      echartsInstance.current = echarts.init(chartRef.current);
    }
    const handleResize = () => echartsInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      echartsInstance.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!echartsInstance.current) return;

    // Convert points to ENU relative to cepStats.refLat, refLon
    const refLat = cepStats.refLat;
    const refLon = cepStats.refLon;

    const scatterData = points.map((p, idx) => {
      const { x, y } = wgs84ToEnu(p.lat, p.lon, refLat, refLon);
      const isLatest = idx >= points.length - 5;
      return {
        value: [x, y],
        itemStyle: {
          color: isLatest ? '#00ff66' : 'rgba(0, 255, 102, 0.35)',
          borderColor: isLatest ? '#ffffff' : '#15803d',
          borderWidth: isLatest ? 1.5 : 0.5,
        },
      };
    });

    // Determine axis bounds dynamically
    const maxBound = Math.max(
      cepStats.maxError * 1.2,
      cepStats.drms2 * 1.3,
      cepStats.r95 * 1.3,
      0.5 // minimum 0.5m bound
    );

    // Generate circle points for CEP50, R95, 2DRMS
    const generateCircleSeries = (radius: number) => {
      if (radius <= 0) return [];
      const circlePts: [number, number][] = [];
      const steps = 72;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * 2 * Math.PI;
        circlePts.push([radius * Math.cos(theta), radius * Math.sin(theta)]);
      }
      return circlePts;
    };

    const cep50Circle = generateCircleSeries(cepStats.cep50);
    const r95Circle = generateCircleSeries(cepStats.r95);
    const drms2Circle = generateCircleSeries(cepStats.drms2);

    const option: echarts.EChartsOption = {
      backgroundColor: '#000000',
      title: {
        text: 'CIRCULAR ERROR PROBABLE (CEP) LOCAL ENU',
        left: 10,
        top: 8,
        textStyle: {
          color: '#00ff66',
          fontSize: 11,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        },
      },
      legend: {
        right: 10,
        top: 8,
        textStyle: { color: '#00ff66', fontSize: 10, fontFamily: 'monospace' },
        data: ['CEP 50%', 'R95 (95%)', '2DRMS'],
      },
      grid: {
        top: 36,
        left: 45,
        right: 20,
        bottom: 35,
      },
      tooltip: {
        backgroundColor: '#050805',
        borderColor: '#00ff66',
        textStyle: { color: '#00ff66', fontFamily: 'monospace', fontSize: 11 },
        formatter: (params: any) => {
          if (params.seriesType === 'scatter') {
            const [x, y] = params.data.value;
            const r = Math.sqrt(x * x + y * y);
            return `<b>Scatter Point</b><br/>East: ${x.toFixed(3)} m<br/>North: ${y.toFixed(3)} m<br/>Radius: ${r.toFixed(3)} m`;
          }
          return `${params.seriesName}`;
        },
      },
      xAxis: {
        name: 'East (m)',
        nameLocation: 'middle',
        nameGap: 20,
        nameTextStyle: { color: '#15803d', fontFamily: 'monospace', fontSize: 10 },
        type: 'value',
        min: -maxBound,
        max: maxBound,
        axisLine: { lineStyle: { color: '#1b3d22' } },
        splitLine: { lineStyle: { color: '#0f2214', type: 'dashed' } },
        axisLabel: { color: '#00ff66', fontFamily: 'monospace', fontSize: 9, formatter: '{value}m' },
      },
      yAxis: {
        name: 'North (m)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#15803d', fontFamily: 'monospace', fontSize: 10 },
        type: 'value',
        min: -maxBound,
        max: maxBound,
        axisLine: { lineStyle: { color: '#1b3d22' } },
        splitLine: { lineStyle: { color: '#0f2214', type: 'dashed' } },
        axisLabel: { color: '#00ff66', fontFamily: 'monospace', fontSize: 9, formatter: '{value}m' },
      },
      series: [
        {
          name: 'Positions',
          type: 'scatter',
          symbolSize: 6,
          data: scatterData,
          z: 5,
        },
        {
          name: 'CEP 50%',
          type: 'line',
          showSymbol: false,
          data: cep50Circle,
          lineStyle: { color: '#00ff66', width: 1.5, type: 'solid' },
          z: 3,
        },
        {
          name: 'R95 (95%)',
          type: 'line',
          showSymbol: false,
          data: r95Circle,
          lineStyle: { color: '#eab308', width: 1.5, type: 'dashed' },
          z: 3,
        },
        {
          name: '2DRMS',
          type: 'line',
          showSymbol: false,
          data: drms2Circle,
          lineStyle: { color: '#38bdf8', width: 1.5, type: 'dotted' },
          z: 3,
        },
      ],
    };

    echartsInstance.current.setOption(option);
  }, [points, cepStats]);

  return (
    <div className="flex flex-col h-full bg-cyber-black border border-cyber-border corner-box relative">
      {/* Upper ECharts Canvas */}
      <div className="flex-1 w-full min-h-[220px]" ref={chartRef} />

      {/* Bottom Metrics Bar */}
      <div className="p-2 border-t border-cyber-border bg-cyber-dark/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
        <div className="border border-cyber-border p-1.5 flex flex-col justify-center">
          <span className="text-[10px] text-cyber-muted">SAMPLES</span>
          <span className="text-cyber-line font-bold text-sm">{cepStats.count}</span>
        </div>

        <div className="border border-cyber-border p-1.5 flex flex-col justify-center">
          <span className="text-[10px] text-cyber-line flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyber-line inline-block" /> CEP (50%)
          </span>
          <span className="text-cyber-line font-bold text-sm">
            {cepStats.cep50.toFixed(3)} <span className="text-[10px] font-normal">m</span>
          </span>
        </div>

        <div className="border border-cyber-border p-1.5 flex flex-col justify-center">
          <span className="text-[10px] text-yellow-400 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-yellow-400 inline-block border-dashed" /> R95 (95%)
          </span>
          <span className="text-yellow-400 font-bold text-sm">
            {cepStats.r95.toFixed(3)} <span className="text-[10px] font-normal">m</span>
          </span>
        </div>

        <div className="border border-cyber-border p-1.5 flex flex-col justify-center">
          <span className="text-[10px] text-sky-400 flex items-center gap-1">
            <span className="w-2 h-0.5 bg-sky-400 inline-block border-dotted" /> 2DRMS (98%)
          </span>
          <span className="text-sky-400 font-bold text-sm">
            {cepStats.drms2.toFixed(3)} <span className="text-[10px] font-normal">m</span>
          </span>
        </div>

        <div className="border border-cyber-border p-1.5 flex flex-col justify-center">
          <span className="text-[10px] text-cyber-muted">MAX ERROR</span>
          <span className="text-cyber-line font-bold text-sm">
            {cepStats.maxError.toFixed(3)} <span className="text-[10px] font-normal">m</span>
          </span>
        </div>

        <div className="border border-cyber-border p-1 flex items-center justify-between gap-1">
          <button
            onClick={() => {
              if (manualRefCoord) {
                onSetManualRef(null);
              } else if (points.length > 0) {
                const latest = points[points.length - 1];
                onSetManualRef({ lat: latest.lat, lon: latest.lon });
              }
            }}
            className="flex-1 py-1 px-1.5 border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line text-[10px] flex items-center justify-center gap-1"
            title="Toggle between Mean Center and Manual Reference"
          >
            <Target className="w-3 h-3" />
            {manualRefCoord ? 'REF:FIXED' : 'REF:MEAN'}
          </button>
          <button
            onClick={onResetCep}
            className="py-1 px-1.5 border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line text-[10px] flex items-center justify-center"
            title="Reset CEP Sample Points"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
