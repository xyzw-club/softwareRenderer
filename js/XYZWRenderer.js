XYZWRenderer = function ( parameters ) {
  this.parameters = parameters;
  this.domElement = document.createElement("canvas");
  this.width = this.domElement.width;
  this.height = this.domElement.height;
};

XYZWRenderer.prototype = {

  setSize: function(width, height) {
    this.domElement.width = width;
    this.domElement.height = height;
    this.width = this.domElement.width;
    this.height = this.domElement.height;
  },

  projectVertex: function ( src, modelMatrix, viewProjectionMatrix ) {
    var vertex = new THREE.RenderableVertex();
    vertex.position.set(src.x, src.y, src.z);

    var position = vertex.position;
    var positionWorld = vertex.positionWorld;
    var positionScreen = vertex.positionScreen;

    positionWorld.copy( position ).applyMatrix4( modelMatrix );
    positionScreen.copy( positionWorld ).applyMatrix4( viewProjectionMatrix );

    var invW = 1 / positionScreen.w;

    positionScreen.x *= invW;
    positionScreen.y *= invW;
    positionScreen.z *= invW;

    vertex.visible = positionScreen.x >= - 1 && positionScreen.x <= 1 &&
      positionScreen.y >= - 1 && positionScreen.y <= 1 &&
      positionScreen.z >= - 1 && positionScreen.z <= 1;

    return vertex;
  },

  shade:  function(v1, v2, v3, lights, normalMatrix, matrixWorld) {
      var cb = new THREE.Vector3();
      var ab = new THREE.Vector3();
      cb.subVectors( v1, v2 ).normalize();
      ab.subVectors( v3, v2 ).normalize();
      cb.cross( ab );

      var normal = new THREE.Vector3().copy(cb);

      // not at all sure if this is right
      normal.normalize();
      normal.applyMatrix4(matrixWorld);
      normal.applyMatrix3(normalMatrix).normalize();

      // ambient light
      var ambient = new THREE.Color(0x020202);
      var diffuse = new THREE.Color(0x827461);

      for (var l=0, vl = lights.length; l < vl; l++) {
        var light = lights[l];
        var lightPosition = new THREE.Vector3().setFromMatrixPosition( light.matrixWorld ).normalize();
        var lightWeight = Math.max(normal.dot( lightPosition ), 0.0);
        ambient.add( new THREE.Color(0xffffff).multiplyScalar(lightWeight)); 
      }
      return diffuse.multiply(ambient);
    },
  render: function(scene, camera) {
    var viewMatrix = new THREE.Matrix4(),
    viewProjectionMatrix = new THREE.Matrix4(),
    normalMatrix = new THREE.Matrix3();

    scene.updateMatrixWorld();
    camera.updateMatrixWorld();

    viewMatrix.copy(camera.matrixWorldInverse);
    viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, viewMatrix);
    normalMatrix.getNormalMatrix(camera.matrixWorldInverse);

    var renderList = [];
    var lights = [];
    var _this = this;

    scene.traverseVisible( function (object) {
      if (object instanceof THREE.DirectionalLight) {
        lights.push(object);
      }
    });

    scene.traverseVisible( function ( object ) {
      if (object instanceof THREE.Mesh) {
        var faces = object.geometry.faces;


        for (var v=0, vl=faces.length; v < vl; v++) {
          var face = faces[v];
          var v1 = object.geometry.vertices[face.a];
          var v2 = object.geometry.vertices[face.b];
          var v3 = object.geometry.vertices[face.c];

          var faceColor = _this.shade(v1, v2, v3, lights, normalMatrix, object.matrixWorld);

          v1 = _this.projectVertex(v1, object.matrixWorld, viewProjectionMatrix);
          v2 = _this.projectVertex(v2, object.matrixWorld, viewProjectionMatrix);
          v3 = _this.projectVertex(v3, object.matrixWorld, viewProjectionMatrix);

          if (v1.visible || v2.visible || v3.visible) {
            renderList.push([v1, v2, v3, faceColor]);
          }
        }
      }
    });
    
    var faceZ = function(face) {
        return ( face[0].positionScreen.z + 
            face[1].positionScreen.z + 
            face[2].positionScreen.z ) / 3;
    };


    var canvas = this.domElement;
    var context = canvas.getContext( '2d', {} );
    context.clearRect(0, 0, canvas.width, canvas.height);

    var to_canvas_position = function(vertex) {
      var canvas_x = (vertex.positionScreen.x / 2.0 + 0.5) * canvas.width;
      var canvas_y = (vertex.positionScreen.y / -2.0 + 0.5) * canvas.height;
      return {x: canvas_x, y: canvas_y};
    };

    renderList.sort( function(a, b) {
      return faceZ(b) - faceZ(a);
    });

    for (var v=0, vl=renderList.length; v < vl; v++) {
      var face = renderList[v];
      var vv1 = to_canvas_position(face[0]);
      var vv2 = to_canvas_position(face[1]);
      var vv3 = to_canvas_position(face[2]);

      context.beginPath();
      context.moveTo(vv1.x, vv1.y); 
      context.lineTo(vv2.x, vv2.y); 
      context.lineTo(vv3.x, vv3.y); 
      context.fillStyle = face[3].getStyle();
      context.closePath();
      context.fill();
    }

  },

};
