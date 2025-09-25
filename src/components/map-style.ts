import { MapLayerMouseEvent } from 'mapbox-gl';

export const mapStyle = {
  version: 8,
  name: 'Social Bubble Dark',
  sprite: 'mapbox://sprites/mapbox/dark-v11',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  sources: {
    'mapbox-streets': {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8'
    },
    'wave-pattern': {
      type: 'image',
      url: '/wave-pattern.svg',
      coordinates: [
        [-180, 85],
        [180, 85],
        [180, -85],
        [-180, -85]
      ]
    }
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0a0f1f'
      }
    },
    {
      id: 'wave-overlay',
      type: 'raster',
      source: 'wave-pattern',
      paint: {
        'raster-opacity': 0.15,
        'raster-fade-duration': 0
      }
    }
  ]
};

export const heatmapLayer = {
  id: 'location-heat',
  type: 'heatmap',
  source: 'locations',
  maxzoom: 15,
  paint: {
    'heatmap-weight': [
      'interpolate',
      ['linear'],
      ['get', 'magnitude'],
      0, 0,
      6, 1
    ],
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 1,
      15, 3
    ],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(33,196,235,0)',
      0.2, 'rgb(33,196,235)',
      0.4, 'rgb(38,242,203)',
      0.6, 'rgb(233,253,47)',
      0.8, 'rgb(255,190,11)',
      1, 'rgb(255,102,0)'
    ],
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 2,
      9, 20
    ],
    'heatmap-opacity': 0.8
  }
};