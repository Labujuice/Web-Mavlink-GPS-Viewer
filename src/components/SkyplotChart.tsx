import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { SatelliteInfo } from '../types/mavlink';

interface SkyplotChartProps {
  satellites: SatelliteInfo[];
}

export const SkyplotChart: React.FC<SkyplotChartProps> = ({ satellites }) => {
  const polarRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const polarChartRef = useRef<echarts.ECharts | null>(null);
  const barChartRef = useRef<echarts.ECharts | null>(null);

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

    return () => {
      window.removeEventListener('resize', handleResize);
      polarChartRef.current?.dispose();
      barChartRef.current?.dispose();
    };
  }, []);

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

    const option: echarts.EChartsOption = {
      backgroundColor: '#000000',
      title: {
        text: 'CONSTELLATION SKYPLOT (AZ / EL)',
        left: 10,
        top: 8,
        textStyle: {
          color: '#00ff66',
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
        backgroundColor: '#050805',
        borderColor: '#00ff66',
        textStyle: { color: '#00ff66', fontFamily: 'monospace', fontSize: 11 },
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
        axisLine: { lineStyle: { color: '#14331a' } },
        splitLine: { lineStyle: { color: '#102815', type: 'dashed' } },
        axisLabel: {
          color: '#00ff66',
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
        axisLine: { lineStyle: { color: '#14331a' } },
        splitLine: { lineStyle: { color: '#14331a' } },
        axisLabel: {
          color: '#15803d',
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
            color: 'rgba(0, 255, 102, 0.25)',
            borderColor: '#00ff66',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: (params: any) => `${params.data[2]}`,
            color: '#00ff66',
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
            borderColor: '#15803d',
            borderWidth: 1,
            borderType: 'dashed',
          },
          label: {
            show: true,
            formatter: (params: any) => `${params.data[2]}`,
            color: '#15803d',
            fontFamily: 'monospace',
            fontSize: 9,
          },
        },
      ],
    };

    polarChartRef.current.setOption(option);
  }, [satellites]);

  // Update SNR Bar Chart
  useEffect(() => {
    if (!barChartRef.current) return;

    const validSats = satellites.filter((s) => s.prn > 0).sort((a, b) => a.prn - b.prn);
    const prnLabels = validSats.map((s) => `#${s.prn}`);
    const snrValues = validSats.map((s) => ({
      value: s.snr,
      itemStyle: {
        color: s.used ? 'rgba(0, 255, 102, 0.7)' : 'rgba(21, 128, 61, 0.4)',
        borderColor: s.used ? '#00ff66' : '#15803d',
        borderWidth: 1,
      },
    }));

    const barOption: echarts.EChartsOption = {
      backgroundColor: '#000000',
      title: {
        text: 'CARRIER-TO-NOISE (C/N0 / SNR)',
        left: 10,
        top: 8,
        textStyle: {
          color: '#00ff66',
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
        backgroundColor: '#050805',
        borderColor: '#00ff66',
        textStyle: { color: '#00ff66', fontFamily: 'monospace', fontSize: 11 },
        formatter: (params: any) => `PRN: ${params.name}<br/>SNR: ${params.value} dB-Hz`,
      },
      xAxis: {
        type: 'category',
        data: prnLabels,
        axisLine: { lineStyle: { color: '#1b3d22' } },
        axisLabel: {
          color: '#00ff66',
          fontFamily: 'monospace',
          fontSize: 9,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 60,
        axisLine: { lineStyle: { color: '#1b3d22' } },
        splitLine: { lineStyle: { color: '#0f2214', type: 'dashed' } },
        axisLabel: {
          color: '#15803d',
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
  }, [satellites]);

  return (
    <div className="flex flex-col h-full bg-cyber-black border border-cyber-border corner-box">
      {/* Skyplot Polar Chart */}
      <div className="h-1/2 min-h-[220px] w-full border-b border-cyber-border relative" ref={polarRef} />
      {/* SNR Bar Chart */}
      <div className="h-1/2 min-h-[140px] w-full relative" ref={barRef} />
    </div>
  );
};
