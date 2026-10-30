(function(){
var src = Folder('C:/Users/acer/Documents/臨時/2026-10');
var base = Folder('C:/Users/acer/Videos/bat-volume/laser-work');
var out = Folder(base.fsName+'/output'); out.create();
var inputs=Folder(base.fsName+'/inputs');inputs.create();
var before = Folder(base.fsName+'/normalized-originals'); before.create();
var after = Folder(base.fsName+'/result-previews'); after.create();
var logs=[];
var oldUI=app.userInteractionLevel;
app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
var PT=72/25.4, BOARD=150*PT, LONG=105*PT;
function black() {var c=new CMYKColor(); c.cyan=0;c.magenta=0;c.yellow=0;c.black=100;return c;}
function pureRGBBlack() {var c=new RGBColor();c.red=0;c.green=0;c.blue=0;return c;}
function white() {var c=new CMYKColor(); c.cyan=0;c.magenta=0;c.yellow=0;c.black=0;return c;}
function isWhite(c) {
  if(c.typename==='GrayColor') return c.gray<1;
  if(c.typename==='CMYKColor') return c.cyan+c.magenta+c.yellow+c.black<1;
  if(c.typename==='RGBColor') return c.red>254&&c.green>254&&c.blue>254;
  throw Error('Unsupported fill '+c.typename);
}
function selectAll(d) { d.selection=null; app.executeMenuCommand('selectall'); }
function exportPNG(d,folder,name) {
  var opt=new ExportOptionsPNG24(); opt.antiAliasing=true; opt.transparency=true; opt.artBoardClipping=true;
  opt.horizontalScale=300; opt.verticalScale=300;
  d.exportFile(File(folder.fsName+'/'+name+'.png'),ExportType.PNG24,opt);
}
function bounds(d) {return Array.prototype.slice.call(d.visibleBounds);}
function normalize(d) {
  selectAll(d); app.executeMenuCommand('group'); var g=d.selection[0];
  if(g.height>g.width) g.rotate(-90,true,true,true,true,Transformation.CENTER);
  var b=g.geometricBounds, scale=LONG/Math.max(b[2]-b[0],b[1]-b[3])*100;
  g.resize(scale,scale,true,true,true,true,scale,Transformation.CENTER);
  b=g.geometricBounds; g.translate(BOARD/2-(b[0]+b[2])/2,BOARD/2-(b[1]+b[3])/2);
  d.artboards[0].artboardRect=[0,BOARD,BOARD,0];
}
function topItems(d) {
  var arr=[]; for(var i=0;i<d.pageItems.length;i++) if(d.pageItems[i].parent.typename==='Layer') arr.push(d.pageItems[i]); return arr;
}
function ungroupAll(d) {
  for(var attempt=0;attempt<30;attempt++) {
    var gs=[];
    for(var i=0;i<d.groupItems.length;i++) if(d.groupItems[i].parent.typename==='Layer') gs.push(d.groupItems[i]);
    if(!gs.length) return;
    d.selection=null; for(var j=0;j<gs.length;j++) gs[j].selected=true;
    app.executeMenuCommand('ungroup');
  }
  throw Error('Could not ungroup');
}
try {
  var files=src.getFiles('*.ai');
  for(var fi=0;fi<files.length;fi++) {
    var copy=File(inputs.fsName+'/'+decodeURI(files[fi].name));files[fi].copy(copy.fsName);
    var d=app.open(copy), name=decodeURI(files[fi].name).replace(/\.ai$/i,'');
    logs.push('\nFILE '+name);
    if(d.rasterItems.length||d.placedItems.length||d.symbolItems.length) throw Error('Non-path artwork');
    while(d.textFrames.length) d.textFrames[0].createOutline();
    for(var p=0;p<d.pathItems.length;p++) {
      var path=d.pathItems[p];
      if(path.clipping||path.stroked||path.hidden||Math.abs(path.opacity-100)>0.001) throw Error('Unexpected path appearance: clipping='+path.clipping+' stroked='+path.stroked+' hidden='+path.hidden+' opacity='+path.opacity+' path='+p+' source='+files[fi].fsName);
      if(path.filled) path.fillColor=isWhite(path.fillColor)?white():black();
    }
    normalize(d);
    logs.push('NORMALIZED '+bounds(d));
    exportPNG(d,before,name);
    selectAll(d); app.executeMenuCommand('Live Pathfinder Merge'); app.executeMenuCommand('expandStyle');
    ungroupAll(d);
    logs.push('MERGED top='+topItems(d).length+' paths='+d.pathItems.length+' groups='+d.groupItems.length);
    var tops=topItems(d);
    for(var t=tops.length-1;t>=0;t--) {
      var obj=tops[t];
      var rep=obj.typename==='CompoundPathItem'?obj.pathItems[0]:obj;
      if(rep.typename!=='PathItem') throw Error('Unexpected result '+obj.typename);
      if(!rep.filled||isWhite(rep.fillColor)) obj.remove();
    }
    selectAll(d); app.executeMenuCommand('group');
    app.executeMenuCommand('Live Pathfinder Add'); app.executeMenuCommand('expandStyle');
    ungroupAll(d);
    selectAll(d);
    var ts=topItems(d);
    if(ts.length!==1||ts[0].typename!=='CompoundPathItem') app.executeMenuCommand('compoundPath');
    ts=topItems(d);
    if(ts.length!==1||ts[0].typename!=='CompoundPathItem'||d.groupItems.length) throw Error('Not a single compound path: '+ts.length);
    var cp=ts[0]; cp.name='雷雕｜純黑填滿・白色挖空';
    app.executeMenuCommand('doc-color-rgb');
    for(var pi=0;pi<cp.pathItems.length;pi++) {
      var path=cp.pathItems[pi];
      path.closed=true;path.filled=true;path.fillColor=pureRGBBlack();path.stroked=false;path.fillOverprint=false;
    }
    var b=cp.geometricBounds;
    logs.push('TRIMMED bounds='+b);
    var scale=LONG/Math.max(b[2]-b[0],b[1]-b[3])*100;
    cp.resize(scale,scale,true,true,true,true,scale,Transformation.CENTER);
    b=cp.geometricBounds;cp.translate(BOARD/2-(b[0]+b[2])/2,BOARD/2-(b[1]+b[3])/2);
    b=cp.geometricBounds;
    logs.push('FINAL bounds='+b+' subpaths='+cp.pathItems.length+' text='+d.textFrames.length);
    d.selection=null;
    exportPNG(d,after,name);
    var save=new IllustratorSaveOptions();save.compatibility=Compatibility.ILLUSTRATOR17;save.pdfCompatible=true;save.compressed=true;save.embedICCProfile=false;
    d.saveAs(File(out.fsName+'/'+name+'_雷雕_105mm.ai'),save);
    d.close(SaveOptions.DONOTSAVECHANGES);
    var lf=File(base.fsName+'/process-log.txt');lf.encoding='UTF-8';lf.open('w');lf.write(logs.join('\n'));lf.close();
  }
} catch(e) {logs.push('ERROR '+e+' line '+e.line);}
finally { app.userInteractionLevel=oldUI;var lf=File(base.fsName+'/process-log.txt');lf.encoding='UTF-8';lf.open('w');lf.write(logs.join('\n'));lf.close(); }
return 'DONE';
})();
