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

  shadeVertex: function ( src, normal, modelMatrix, viewProjectionMatrix, lights ) {
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

    // this only works for uniform scaling because of MATHS.
    vertex.normalWorld = new THREE.Vector3().copy(normal).applyMatrix4(modelMatrix).normalize();

    var ambient = new THREE.Color(0x020202);
    var diffuse = new THREE.Color(0x827461);

    for (var l=0, vl = lights.length; l < vl; l++) {
      var light = lights[l];
      var lightPosition = new THREE.Vector3().setFromMatrixPosition( light.matrixWorld ).normalize();
      var lightWeight = Math.max(vertex.normalWorld.dot( lightPosition ), 0.0);
      ambient.add( new THREE.Color(0xffffff).multiplyScalar(lightWeight)); 
    }

    vertex.colour = diffuse.multiply(ambient);

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

    var rendered_vertex = function(idx, normal, shaded_vertices, object, lights) {
      if (!(idx in shaded_vertices)) {
        shaded_vertices[idx] = _this.shadeVertex(object.geometry.vertices[idx], normal, object.matrixWorld, viewProjectionMatrix, lights);
      }
      return shaded_vertices[idx];
    };

    var faceZ = function(face) {
      return ( face[0].positionScreen.z + 
          face[1].positionScreen.z + 
          face[2].positionScreen.z ) / 3;
    };

    var lights = [];

    scene.traverseVisible( function (object) {
      if (object instanceof THREE.DirectionalLight) {
        lights.push(object);
      }
    });

    scene.traverseVisible( function ( object ) {
      if (object instanceof THREE.Mesh) {
        var shaded_vertices = {};
        var faces = object.geometry.faces;

        for (var v=0, vl=faces.length; v < vl; v++) {
          var face = faces[v];

          var a = rendered_vertex(face.a, face.vertexNormals[0], shaded_vertices, object, lights);
          var b = rendered_vertex(face.b, face.vertexNormals[1], shaded_vertices, object, lights);
          var c = rendered_vertex(face.c, face.vertexNormals[2], shaded_vertices, object, lights);

          if (a.visible || b.visible || c.visible) {
            renderList.push([a,b,c]);
          }
        }
      }
    });

    var canvas = this.domElement;
    var context = canvas.getContext( '2d', {} );
    context.clearRect(0, 0, canvas.width, canvas.height);

    renderList.sort( function(a, b) {
      return faceZ(b) - faceZ(a);
    });

    var to_canvas_position = function(vertex) {
      vertex.x = (vertex.positionScreen.x / 2.0 + 0.5) * canvas.width;
      vertex.y = (vertex.positionScreen.y / -2.0 + 0.5) * canvas.height;
      return vertex; 
    };

    for (var v=0, vl=renderList.length; v < vl; v++) {
      var face = renderList[v];
      var vv1 = to_canvas_position(face[0]);
      var vv2 = to_canvas_position(face[1]);
      var vv3 = to_canvas_position(face[2]);

      _this.drawTriangle(context, vv1, vv2, vv3);
    }

  },

  shadeFragment: function(colour) {
    return colour;
  },

  drawTriangle: function(context, v1, v2, v3) {
    // calculate bounding box
    var maxX = Math.max(v1.x, Math.max(v2.x, v3.x));
    var minX = Math.min(v1.x, Math.min(v2.x, v3.x));
    var maxY = Math.max(v1.y, Math.max(v2.y, v3.y));
    var minY = Math.min(v1.y, Math.min(v2.y, v3.y));

    var base = new THREE.Vector2(v1.x, v1.y);
    var vv0 = new THREE.Vector2(v2.x, v2.y).sub(base);
    var vv1 = new THREE.Vector2(v3.x, v3.y).sub(base);

    face = new RenderableFace(v1, v2, v3, context);

    for (var x = minX; x <= maxX; x++)
    {
      for (var y = minY; y <= maxY; y++)
      {
        var vv2 = new THREE.Vector2(x,y).sub(base);

        var dot00 = vv0.dot(vv0);
        var dot01 = vv0.dot(vv1);
        var dot02 = vv0.dot(vv2);
        var dot11 = vv1.dot(vv1);
        var dot12 = vv1.dot(vv2);

        var invDenom = 1  / (dot00 * dot11 - dot01 * dot01);


        var s = (dot11 * dot02 - dot01 * dot12) * invDenom; 
        var t = (dot00 * dot12 - dot01 * dot02) * invDenom; 

        if ( (s >= 0) && (t >= 0) && (s + t <= 1))
        { 
          face.render(x,y,s,t,this.shadeFragment);  
        }
      }
    }
  }


};

RenderableFace = function(v1, v2, v3, context) {
  this.v1 = v1;
  this.v2 = v2;
  this.v3 = v3;
  this.context = context;
};


RenderableFace.prototype = {
  render: function(x,y,s,t,shader) {
    var w = 1 - (s+t);

    var c1s = new THREE.Color().copy(this.v1.colour).multiplyScalar(t);
    var c2s = new THREE.Color().copy(this.v2.colour).multiplyScalar(w);
    var c3s = new THREE.Color().copy(this.v3.colour).multiplyScalar(s);

    c1s.add(c2s).add(c3s);    
    var color = shader(c1s);
    color.a = 1.0;
    this.context.fillStyle = color.getStyle();
    this.context.fillRect(x,y,1,1);
  }
};

