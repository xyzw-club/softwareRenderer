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

  render: function(scene, camera) {
    var viewMatrix = new THREE.Matrix4(),
    viewProjectionMatrix = new THREE.Matrix4();

    scene.updateMatrixWorld();

    viewMatrix.copy(camera.matrixWorldInverse);
    viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, viewMatrix);

    renderList = [];

    var _this = this;
    scene.traverseVisible( function ( object ) {
      if (object instanceof THREE.Mesh) {
        var faces = object.geometry.faces;


        for (var v=0, vl=faces.length; v < vl; v++) {
          var face = faces[v];
          var v1 = object.geometry.vertices[face.a];
          var v2 = object.geometry.vertices[face.b];
          var v3 = object.geometry.vertices[face.c];

          v1 = _this.projectVertex(v1, object.matrixWorld, viewProjectionMatrix);
          v2 = _this.projectVertex(v2, object.matrixWorld, viewProjectionMatrix);
          v3 = _this.projectVertex(v3, object.matrixWorld, viewProjectionMatrix);

          if (v1.visible || v2.visible || v3.visible) {
            renderList.push([v1, v2, v3])
          }
        }
      }
    });

    var canvas = this.domElement;
    var context = canvas.getContext( '2d', {} );
    context.clearRect(0, 0, canvas.width, canvas.height);

    var to_canvas_position = function(vertex) {
      var canvas_x = (vertex.positionScreen.x / 2.0 + 0.5) * canvas.width;
      var canvas_y = (vertex.positionScreen.y / -2.0 + 0.5) * canvas.height;
      return {x: canvas_x, y: canvas_y};
    }

    for (var v=0, vl=renderList.length; v < vl; v++) {
      var face = renderList[v];
      var vv1 = to_canvas_position(face[0]);
      var vv2 = to_canvas_position(face[1]);
      var vv3 = to_canvas_position(face[2]);

      context.beginPath();

      context.moveTo(vv1.x, vv1.y); 
      context.lineTo(vv2.x, vv2.y); 
      context.lineTo(vv3.x, vv3.y); 
      context.lineTo(vv1.x, vv1.y); 

      context.stroke();
    }

  },

};
