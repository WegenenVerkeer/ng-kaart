import * as olCollection from "ol/Collection";
import * as olColor from "ol/color";
import * as olControl from "ol/control";
import * as olCoordinate from "ol/coordinate";
import * as olEvents from "ol/events";
import * as olEventsCondition from "ol/events/condition";
import { default as olEventsEvent } from "ol/events/Event";
import * as olExtent from "ol/extent";
import { default as Feature } from "ol/Feature";
import * as olFormat from "ol/format";
import * as olFormatGeoJSON from "ol/format/GeoJSON";
import * as olGeom from "ol/geom";
import { default as olGeomGeometryType } from "ol/geom/GeometryType";
import * as olHas from "ol/has";
import * as olInteraction from "ol/interaction";
import * as olInteractionDraw from "ol/interaction/Draw";
import * as olInteractionSelect from "ol/interaction/Select";
import * as olLayer from "ol/layer";
import { default as olLayerBase } from "ol/layer/Base";
import * as olLoadingstrategy from "ol/loadingstrategy";
import * as olObservable from "ol/Observable";
import { default as olOverlayPositioning } from "ol/OverlayPositioning";
import * as olProj from "ol/proj";
import * as olProjProj4 from "ol/proj/proj4";
import { default as olProjProjectionProjection } from "ol/proj/Projection";
import * as olSource from "ol/source";
import * as olSourceWMTS from "ol/source/WMTS";
import * as olSphere from "ol/sphere";
import * as olStyle from "ol/style";
import { default as olStyleIconAnchorUnits } from "ol/style/IconAnchorUnits";
import { default as olStyleIconOrigin } from "ol/style/IconOrigin";
import * as olTilegrid from "ol/tilegrid";

export { Color } from "ol/color";
export { Coordinate } from "ol/coordinate";
export { default as Collection } from "ol/Collection";
export { default as Feature } from "ol/Feature";
export { default as ImageTile } from "ol/ImageTile";
export { default as Map } from "ol/Map";
export { default as MapBrowserEvent } from "ol/MapBrowserEvent";
export { default as Object } from "ol/Object";
export { ObjectEvent } from "ol/Object";
export { default as Observable } from "ol/Observable";
export { default as styleStyle } from "ol/style/Style";
export { default as Tile } from "ol/Tile";
export { default as View } from "ol/View";
export { EventsKey } from "ol/events";
export { Extent } from "ol/extent";
export { Overlay } from "ol";
export { Pixel } from "ol/pixel";
export { StyleFunction } from "ol/style/Style";

import * as olHacks from "./olhack";

export namespace collection {
  export import Event = olCollection.CollectionEvent;
}

export namespace color {
  export import Color = olColor.Color;
  export import asArray = olColor.asArray;
  export import asString = olColor.asString;
  export import normalize = olColor.normalize;
  export import toString = olColor.toString;
}

export namespace coordinate {
  export import Coordinate = olCoordinate.Coordinate;
  export import CoordinateFormat = olCoordinate.CoordinateFormat;
  export import add = olCoordinate.add;
  export import closestOnCircle = olCoordinate.closestOnCircle;
  export import closestOnSegment = olCoordinate.closestOnSegment;
  export import createStringXY = olCoordinate.createStringXY;
  export import degreesToStringHDMS = olCoordinate.degreesToStringHDMS;
  export import distance = olCoordinate.distance;
  export import equals = olCoordinate.equals;
  export import format = olCoordinate.format;
  export import rotate = olCoordinate.rotate;
  export import scale = olCoordinate.scale;
  export import squaredDistance = olCoordinate.squaredDistance;
  export import squaredDistanceToSegment = olCoordinate.squaredDistanceToSegment;
  export import toStringHDMS = olCoordinate.toStringHDMS;
  export import toStringXY = olCoordinate.toStringXY;
}

export namespace control {
  export import Attribution = olControl.Attribution;
  export import Control = olControl.Control;
  export import FullScreen = olControl.FullScreen;
  export import MousePosition = olControl.MousePosition;
  export import OverviewMap = olControl.OverviewMap;
  export import Rotate = olControl.Rotate;
  export import ScaleLine = olControl.ScaleLine;
  export import Zoom = olControl.Zoom;
  export import ZoomSlider = olControl.ZoomSlider;
  export import ZoomToExtent = olControl.ZoomToExtent;
}

export namespace events {
  export import EventsKey = olEvents.EventsKey;
  export import ListenerFunction = olEvents.ListenerFunction;
  export import bindListener = olEvents.bindListener;
  export import findListener = olEvents.findListener;
  export import getListeners = olEvents.getListeners;
  export import listen = olEvents.listen;
  export import listenOnce = olEvents.listenOnce;
  export import unlisten = olEvents.unlisten;
  export import unlistenAll = olEvents.unlistenAll;
  export import unlistenByKey = olEvents.unlistenByKey;

  export type Event = olEventsEvent;

  export namespace condition {
    export import Condition = olEventsCondition.Condition;
    export import always = olEventsCondition.always;
    export import never = olEventsCondition.never;
    export import altKeyOnly = olEventsCondition.altKeyOnly;
    export import altShiftKeysOnly = olEventsCondition.altShiftKeysOnly;
    export import click = olEventsCondition.click;
    export import doubleClick = olEventsCondition.doubleClick;
    export import focus = olEventsCondition.focus;
    export import mouseActionButton = olEventsCondition.mouseActionButton;
    export import mouseOnly = olEventsCondition.mouseOnly;
    export import noModifierKeys = olEventsCondition.noModifierKeys;
    export import platformModifierKeyOnly = olEventsCondition.platformModifierKeyOnly;
    export import pointerMove = olEventsCondition.pointerMove;
    export import primaryAction = olEventsCondition.primaryAction;
    export import shiftKeyOnly = olEventsCondition.shiftKeyOnly;
    export import singleClick = olEventsCondition.singleClick;
    export import targetNotEditable = olEventsCondition.targetNotEditable;
  }
}

export namespace extent {
  export import Extent = olExtent.Extent;
  export import applyTransform = olExtent.applyTransform;
  export import boundingExtent = olExtent.boundingExtent;
  export import buffer = olExtent.buffer;
  export import clone = olExtent.clone;
  export import closestSquaredDistanceXY = olExtent.closestSquaredDistanceXY;
  export import containsCoordinate = olExtent.containsCoordinate;
  export import containsExtent = olExtent.containsExtent;
  export import containsXY = olExtent.containsXY;
  export import coordinateRelationship = olExtent.coordinateRelationship;
  export import createEmpty = olExtent.createEmpty;
  export import createOrUpdate = olExtent.createOrUpdate;
  export import createOrUpdateEmpty = olExtent.createOrUpdateEmpty;
  export import createOrUpdateFromCoordinate = olExtent.createOrUpdateFromCoordinate;
  export import createOrUpdateFromCoordinates = olExtent.createOrUpdateFromCoordinates;
  export import createOrUpdateFromFlatCoordinates = olExtent.createOrUpdateFromFlatCoordinates;
  export import createOrUpdateFromRings = olExtent.createOrUpdateFromRings;
  export import equals = olExtent.equals;
  export import extend = olExtent.extend;
  export import extendCoordinate = olExtent.extendCoordinate;
  export import extendCoordinates = olExtent.extendCoordinates;
  export import extendFlatCoordinates = olExtent.extendFlatCoordinates;
  export import extendRings = olExtent.extendRings;
  export import extendXY = olExtent.extendXY;
  export import forEachCorner = olExtent.forEachCorner;
  export import getArea = olExtent.getArea;
  export import getBottomLeft = olExtent.getBottomLeft;
  export import getBottomRight = olExtent.getBottomRight;
  export import getCenter = olExtent.getCenter;
  export import getCorner = olExtent.getCorner;
  export import getEnlargedArea = olExtent.getEnlargedArea;
  export import getForViewAndSize = olExtent.getForViewAndSize;
  export import getHeight = olExtent.getHeight;
  export import getIntersection = olExtent.getIntersection;
  export import getIntersectionArea = olExtent.getIntersectionArea;
  export import getMargin = olExtent.getMargin;
  export import getSize = olExtent.getSize;
  export import getTopLeft = olExtent.getTopLeft;
  export import getTopRight = olExtent.getTopRight;
  export import getWidth = olExtent.getWidth;
  export import intersects = olExtent.intersects;
  export import intersectsSegment = olExtent.intersectsSegment;
  export import isEmpty = olExtent.isEmpty;
  export import returnOrUpdate = olExtent.returnOrUpdate;
  export import scaleFromCenter = olExtent.scaleFromCenter;
}

export namespace format {
  export import EsriJSON = olFormat.EsriJSON;
  export import GeoJSON = olFormat.GeoJSON;
  export import GML = olFormat.GML;
  export import GPX = olFormat.GPX;
  export import IGC = olFormat.IGC;
  export import KML = olFormat.KML;
  export import MVT = olFormat.MVT;
  export import OWS = olFormat.OWS;
  export import Polyline = olFormat.Polyline;
  export import TopoJSON = olFormat.TopoJSON;
  export import WFS = olFormat.WFS;
  export import WKT = olFormat.WKT;
  export import WMSCapabilities = olFormat.WMSCapabilities;
  export import WMSGetFeatureInfo = olFormat.WMSGetFeatureInfo;
  export import WMTSCapabilities = olFormat.WMTSCapabilities;

  export import GeoJSONOptions = olFormatGeoJSON.Options;
  export import GeoJSONGeometry = olFormatGeoJSON.GeoJSONGeometry;
  export import GeoJSONFeatureCollection = olFormatGeoJSON.GeoJSONFeatureCollection;
}

export namespace geom {
  export import Circle = olGeom.Circle;
  export import Geometry = olGeom.Geometry;
  export import LineString = olGeom.LineString;
  export import MultiLineString = olGeom.MultiLineString;
  export import MultiPoint = olGeom.MultiPoint;
  export import MultiPolygon = olGeom.MultiPolygon;
  export import Point = olGeom.Point;
  export import Polygon = olGeom.Polygon;

  export import GeometryType = olGeomGeometryType;

  export import LinearRing = olHacks.olGeomLinearRing;
  export import GeometryCollection = olHacks.olGeomGeometryCollection;
}

export namespace has {
  export import DEVICE_PIXEL_RATIO = olHas.DEVICE_PIXEL_RATIO;
  export import GEOLOCATION = olHas.GEOLOCATION;
  export import TOUCH = olHas.TOUCH;
}

export namespace interaction {
  export import DoubleClickZoom = olInteraction.DoubleClickZoom;
  export import DragAndDrop = olInteraction.DragAndDrop;
  export import DragBox = olInteraction.DragBox;
  export import DragPan = olInteraction.DragPan;
  export import DragRotate = olInteraction.DragRotate;
  export import DragRotateAndZoom = olInteraction.DragRotateAndZoom;
  export import DragZoom = olInteraction.DragZoom;
  export import Draw = olInteraction.Draw;
  export import Extent = olInteraction.Extent;
  export import Interaction = olInteraction.Interaction;
  export import KeyboardPan = olInteraction.KeyboardPan;
  export import KeyboardZoom = olInteraction.KeyboardZoom;
  export import Modify = olInteraction.Modify;
  export import MouseWheelZoom = olInteraction.MouseWheelZoom;
  export import PinchRotate = olInteraction.PinchRotate;
  export import PinchZoom = olInteraction.PinchZoom;
  export import Pointer = olInteraction.Pointer;
  export import Select = olInteraction.Select;
  export import Snap = olInteraction.Snap;
  export import Translate = olInteraction.Translate;

  export import DrawEvent = olInteractionDraw.DrawEvent;
  export import SelectEvent = olInteractionSelect.SelectEvent;
  export import SelectFilterFunction = olInteractionSelect.FilterFunction;
  export import SelectOptions = olInteractionSelect.Options;

  export import defaults = olInteraction.defaults;
  export import DefaultsOptions = olInteraction.DefaultsOptions;
}

export namespace layer {
  export import Group = olLayer.Group;
  export import Heatmap = olLayer.Heatmap;
  export import Image = olLayer.Image;
  export import Layer = olLayer.Layer;
  export import Tile = olLayer.Tile;
  export import Vector = olLayer.Vector;
  export import VectorTile = olLayer.VectorTile;

  export type Base = olLayerBase;
}

export namespace observable {
  export import unByKey = olObservable.unByKey; // Used to be in Obsersable
}

export namespace loadingstrategy {
  export import all = olLoadingstrategy.all;
  export import bbox = olLoadingstrategy.bbox;
  export import tile = olLoadingstrategy.tile;
}

export namespace overlay {
  export import Positioning = olOverlayPositioning;
}

export namespace proj {
  export import ProjectionLike = olProj.ProjectionLike;
  export import TransformFunction = olProj.TransformFunction;
  export import addCommon = olProj.addCommon;
  export import addCoordinateTransforms = olProj.addCoordinateTransforms;
  export import addEquivalentProjections = olProj.addEquivalentProjections;
  export import addEquivalentTransforms = olProj.addEquivalentTransforms;
  export import addProjection = olProj.addProjection;
  export import addProjections = olProj.addProjections;
  export import clearAllProjections = olProj.clearAllProjections;
  export import cloneTransform = olProj.cloneTransform;
  export import createProjection = olProj.createProjection;
  export import createTransformFromCoordinateTransform = olProj.createTransformFromCoordinateTransform;
  export import equivalent = olProj.equivalent;
  export import fromLonLat = olProj.fromLonLat;
  export import get = olProj.get;
  export import getPointResolution = olProj.getPointResolution;
  export import getTransform = olProj.getTransform;
  export import getTransformFromProjections = olProj.getTransformFromProjections;
  export import identityTransform = olProj.identityTransform;
  export import toLonLat = olProj.toLonLat;
  export import transform = olProj.transform;
  export import transformExtent = olProj.transformExtent;
  export import transformWithProjections = olProj.transformWithProjections;

  export import setProj4 = olProjProj4.register;
  export type Projection = olProjProjectionProjection;
}

export namespace source {
  export import BingMaps = olSource.BingMaps;
  export import CartoDB = olSource.CartoDB;
  export import Cluster = olSource.Cluster;
  export import Image = olSource.Image;
  export import ImageArcGISRest = olSource.ImageArcGISRest;
  export import ImageCanvas = olSource.ImageCanvas;
  export import ImageMapGuide = olSource.ImageMapGuide;
  export import ImageStatic = olSource.ImageStatic;
  export import ImageWMS = olSource.ImageWMS;
  export import OSM = olSource.OSM;
  export import Raster = olSource.Raster;
  export import Source = olSource.Source;
  export import Stamen = olSource.Stamen;
  export import Tile = olSource.Tile;
  export import TileArcGISRest = olSource.TileArcGISRest;
  export import TileDebug = olSource.TileDebug;
  export import TileImage = olSource.TileImage;
  export import TileJSON = olSource.TileJSON;
  export import TileWMS = olSource.TileWMS;
  export import UrlTile = olSource.UrlTile;
  export import UTFGrid = olSource.UTFGrid;
  export import Vector = olSource.Vector;
  export import VectorTile = olSource.VectorTile;
  export import WMTS = olSource.WMTS;
  export import XYZ = olSource.XYZ;
  export import Zoomify = olSource.Zoomify;

  export import WMTSOptions = olSourceWMTS.Options;

  export namespace wmts {
    export import optionsFromCapabilities = olSourceWMTS.optionsFromCapabilities;
  }
}

export namespace Sphere {
  export import getArea = olSphere.getArea;
  export import getDistance = olSphere.getDistance;
  export import getLength = olSphere.getLength;
  export import offset = olSphere.offset;
}

export namespace style {
  export import Atlas = olStyle.Atlas;
  export import AtlasManager = olStyle.AtlasManager;
  export import Circle = olStyle.Circle;
  export import Fill = olStyle.Fill;
  export import Icon = olStyle.Icon;
  export import IconImage = olStyle.IconImage;
  export import Image = olStyle.Image;
  export import RegularShape = olStyle.RegularShape;
  export import Stroke = olStyle.Stroke;
  export import Style = olStyle.Style;
  export import Text = olStyle.Text;

  export import IconAnchorUnits = olStyleIconAnchorUnits;
  export import IconOrigin = olStyleIconOrigin;
}

export namespace tilegrid {
  export import XYZOptions = olTilegrid.XYZOptions;
  export import createForExtent = olTilegrid.createForExtent;
  export import createForProjection = olTilegrid.createForProjection;
  export import createXYZ = olTilegrid.createXYZ;
  export import extentFromProjection = olTilegrid.extentFromProjection;
  export import getForProjection = olTilegrid.getForProjection;
  export import wrapX = olTilegrid.wrapX;

  export import WMTSTileGrid = olHacks.olTilegridWMTS;
}

// Te generiek in @types/ol
export type Size = [number, number];
// verdwenen in OL 6
export type StyleGeometryFunction = (feature: Feature) => geom.Geometry;
