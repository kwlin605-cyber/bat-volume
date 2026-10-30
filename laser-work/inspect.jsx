var src = Folder('C:/Users/acer/Documents/臨時/2026-10');
var out = Folder('C:/Users/acer/Videos/bat-volume/laser-work');
var prev = Folder(out.fsName + '/original-previews'); prev.create();
var oldUI = app.userInteractionLevel;
app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
var log = [];
function color(c) {
  if (!c) return '-';
  if (c.typename === 'CMYKColor') return 'CMYK '+[c.cyan,c.magenta,c.yellow,c.black];
  if (c.typename === 'RGBColor') return 'RGB '+[c.red,c.green,c.blue];
  if (c.typename === 'GrayColor') return 'Gray '+c.gray;
  return c.typename;
}
function desc(p, depth) {
  var s = Array(depth+1).join(' ') + p.typename + ' '+p.name+' bounds='+p.geometricBounds;
  if(p.typename==='PathItem') s+=' closed='+p.closed+' fill='+p.filled+':'+color(p.fillColor)+' stroke='+p.stroked+' clip='+p.clipping+' pts='+p.pathPoints.length;
  if(p.typename==='TextFrame') s+=' TEXT='+p.contents+' FONT='+p.textRange.characterAttributes.textFont.name;
  if(p.typename==='GroupItem') s+=' clipped='+p.clipped;
  log.push(s);
  if(p.typename==='GroupItem' && depth<5) for(var j=0;j<p.pageItems.length;j++) desc(p.pageItems[j],depth+1);
  if(p.typename==='CompoundPathItem' && depth<5) for(var k=0;k<p.pathItems.length;k++) desc(p.pathItems[k],depth+1);
}
try {
  var files=src.getFiles('*.ai');
  for(var i=0;i<files.length;i++) {
    var d=app.open(files[i]);
    log.push('\nFILE '+decodeURI(files[i].name)+' ARTBOARDS='+d.artboards.length+' BOUNDS='+d.visibleBounds+' PATHS='+d.pathItems.length+' TEXTS='+d.textFrames.length+' RASTERS='+d.rasterItems.length+' PLACED='+d.placedItems.length+' SYMBOLS='+d.symbolItems.length);
    for(var l=0;l<d.layers.length;l++) {
      log.push('LAYER '+d.layers[l].name+' visible='+d.layers[l].visible+' locked='+d.layers[l].locked);
      for(var p=0;p<d.layers[l].pageItems.length;p++) if(d.layers[l].pageItems[p].parent===d.layers[l]) desc(d.layers[l].pageItems[p],0);
    }
    var b=d.visibleBounds; d.artboards[0].artboardRect=[b[0]-5,b[1]+5,b[2]+5,b[3]-5];
    var opt=new ExportOptionsPNG24(); opt.antiAliasing=true; opt.transparency=false; opt.artBoardClipping=true;
    opt.horizontalScale=1000/(b[2]-b[0]+10)*100; opt.verticalScale=opt.horizontalScale;
    d.exportFile(File(prev.fsName+'/'+decodeURI(files[i].name)+'.png'),ExportType.PNG24,opt);
    d.close(SaveOptions.DONOTSAVECHANGES);
  }
} catch(e) {log.push('ERROR '+e+' line '+e.line);}
finally { app.userInteractionLevel=oldUI; var f=File(out.fsName+'/inspection.txt'); f.encoding='UTF-8'; f.open('w'); f.write(log.join('\n')); f.close(); }
'DONE';
