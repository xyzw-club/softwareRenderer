var XYZW  = XYZW  || {};

(function(XYZW) {
XYZW.Crates = {};  
XYZW.Crates.getCrate  = function(baseURL){
  var geometry  = new THREE.BoxGeometry( 1, 1, 1);
  var material  = new THREE.MeshPhongMaterial({
    map   : THREE.ImageUtils.loadTexture(baseURL+'assets/crate/crate0_diffuse.jpg'),
    normalMap : THREE.ImageUtils.loadTexture(baseURL+'assets/crate/crate0_normal.png'),
    normalScale : new THREE.Vector2(0.3,0.3),
  })
  var mesh  = new THREE.Mesh( geometry, material );
  return mesh 
}

})(XYZW);


