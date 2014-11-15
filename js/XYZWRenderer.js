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
        var vertices = object.geometry.vertices;
        for (var v=0, vl=vertices.length; v < vl; v++) {
          var vertex = _this.projectVertex(vertices[v], 
            object.matrixWorld, 
            viewProjectionMatrix);
          if (vertex.visible) {
            renderList.push(vertex);
          }
        }
      }
    });

    var canvas = this.domElement;
    var context = canvas.getContext( '2d', {} );
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (var v=0, vl=renderList.length; v < vl; v++) {
      var vertex = renderList[v];
      var canvas_x = (vertex.positionScreen.x / 2.0 + 0.5) * canvas.width;
      var canvas_y = (vertex.positionScreen.y / -2.0 + 0.5) * canvas.height;
      context.fillRect(canvas_x, canvas_y , 4, 4); 
    }

  },

};
