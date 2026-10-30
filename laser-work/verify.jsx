(function(){
var base=Folder('C:/Users/acer/Videos/bat-volume/laser-work');
var output=Folder(base.fsName+'/output');
var before=Folder(base.fsName+'/qa-before');before.create();
var after=Folder(base.fsName+'/qa-after');after.create();
var oldUI=app.userInteractionLevel;app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
var BOARD=150*72/25.4,LONG=105*72/25.4;
var reports=[];
function rgb(v){var c=new RGBColor();c.red=v;c.green=v;c.blue=v;return c;}
function isWhite(c){if(c.typename==='GrayColor')return c.gray<1;if(c.typename==='CMYKColor')return c.cyan+c.magenta+c.yellow+c.black<1;if(c.typename==='RGBColor')return c.red>254&&c.green>254&&c.blue>254;throw Error(c.typename);}
function png(d,folder,name){var o=new ExportOptionsPNG24();o.antiAliasing=true;o.transparency=true;o.artBoardClipping=true;o.horizontalScale=1200;o.verticalScale=1200;d.selection=null;d.exportFile(File(folder.fsName+'/'+name+'.png'),ExportType.PNG24,o);}
function sig(p){
  var parts=[];
  for(var i=0;i<p.pathPoints.length;i++){
    var pt=p.pathPoints[i],a=pt.anchor,l=pt.leftDirection,r=pt.rightDirection;
    var x=[l[0].toFixed(4),l[1].toFixed(4)].join(','),y=[r[0].toFixed(4),r[1].toFixed(4)].join(',');
    parts.push(a[0].toFixed(4)+','+a[1].toFixed(4)+'/'+[x,y].sort().join('/'));
  }
  return parts.sort().join(';');
}
try{
  var f=File(base.fsName+'/process-log.txt');f.open('r');var blocks=f.read().split('\nFILE ');f.close();
  var files=output.getFiles('*.ai');
  for(var fi=0;fi<files.length;fi++){
    var d=app.open(files[fi]);var fileName=decodeURI(files[fi].name).replace(/_雷雕_105mm\.ai$/,'');
    var top=[];for(var ti=0;ti<d.pageItems.length;ti++)if(d.pageItems[ti].parent.typename==='Layer')top.push(d.pageItems[ti]);
    if(top.length!==1||top[0].typename!=='CompoundPathItem')throw Error('Object structure '+fileName+' '+top.length);
    if(d.textFrames.length||d.rasterItems.length||d.placedItems.length||d.groupItems.length)throw Error('Extra objects');
    var cp=top[0],b=cp.geometricBounds,ab=d.artboards[0].artboardRect;
    if(d.documentColorSpace!==DocumentColorSpace.RGB)throw Error('Not RGB');
    var err=Math.max(Math.abs(b[2]-b[0]-LONG),Math.abs((b[0]+b[2])/2-BOARD/2),Math.abs((b[1]+b[3])/2-BOARD/2),Math.abs(ab[0]),Math.abs(ab[1]-BOARD),Math.abs(ab[2]-BOARD),Math.abs(ab[3]));
    if(err>0.001)throw Error('Bounds error '+err);
    var seen={},areas=[];
    for(var pi=0;pi<cp.pathItems.length;pi++){
      var p=cp.pathItems[pi],c=p.fillColor;
      if(!p.closed||!p.filled||p.stroked||p.clipping||p.hidden||Math.abs(p.opacity-100)>0.001||p.fillOverprint)throw Error('Path appearance');
      if(c.typename!=='RGBColor'||c.red!==0||c.green!==0||c.blue!==0)throw Error('Nonblack');
      var key=sig(p);if(seen[key])throw Error('Duplicate contour');seen[key]=true;
      areas.push(p.area);
    }
    png(d,after,fileName);
    reports.push(fileName+'\tPASS\t'+cp.pathItems.length+'\t'+((b[2]-b[0])*25.4/72).toFixed(6)+'\t'+((b[1]-b[3])*25.4/72).toFixed(6)+'\t'+err);
    d.close(SaveOptions.DONOTSAVECHANGES);
    var block=null;for(var k=0;k<blocks.length;k++)if(blocks[k].indexOf(fileName+'\n')===0)block=blocks[k];
    if(!block)throw Error('No transform log '+fileName);
    var trimmed=block.match(/TRIMMED bounds=([^\n]+)/)[1].split(',');for(var k=0;k<4;k++)trimmed[k]=Number(trimmed[k]);
    d=app.open(File(base.fsName+'/inputs/'+fileName+'.ai'));
    app.executeMenuCommand('selectall');app.executeMenuCommand('group');var g=d.selection[0];
    if(g.height>g.width)g.rotate(-90,true,true,true,true,Transformation.CENTER);
    b=g.geometricBounds;var s=LONG/Math.max(b[2]-b[0],b[1]-b[3])*100;g.resize(s,s,true,true,true,true,s,Transformation.CENTER);
    b=g.geometricBounds;g.translate(BOARD/2-(b[0]+b[2])/2,BOARD/2-(b[1]+b[3])/2);
    b=g.geometricBounds;var cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
    s=LONG/Math.max(trimmed[2]-trimmed[0],trimmed[1]-trimmed[3]);
    g.resize(s*100,s*100,true,true,true,true,s*100,Transformation.CENTER);
    b=g.geometricBounds;var nx=(b[0]+b[2])/2,ny=(b[1]+b[3])/2;
    g.translate(BOARD/2-(nx+((trimmed[0]+trimmed[2])/2-cx)*s),BOARD/2-(ny+((trimmed[1]+trimmed[3])/2-cy)*s));
    d.artboards[0].artboardRect=[0,BOARD,BOARD,0];
    var whiteFlags=[];for(var p=0;p<d.pathItems.length;p++)whiteFlags.push(isWhite(d.pathItems[p].fillColor));
    app.executeMenuCommand('doc-color-rgb');
    for(var p=0;p<d.pathItems.length;p++)if(d.pathItems[p].filled)d.pathItems[p].fillColor=rgb(whiteFlags[p]?255:0);
    png(d,before,fileName);d.close(SaveOptions.DONOTSAVECHANGES);
  }
}catch(e){reports.push('ERROR '+e+' line '+e.line);}
finally{app.userInteractionLevel=oldUI;var f=File(base.fsName+'/verification.tsv');f.encoding='UTF-8';f.open('w');f.write(reports.join('\n'));f.close();}
return 'DONE';
})();
