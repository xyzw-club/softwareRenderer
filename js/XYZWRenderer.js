XYZWRenderer = function ( parameters ) {
  this.parameters = parameters;
  this.domElement = document.createElement("canvas");
  this.width = this.domElement.width;
  this.height = this.domElement.height;
  this.context = this.domElement.getContext( '2d', {} );
  //this.context.translate(0.5,0.5);
};

console.sample = function(arg,p) {
  if (p === undefined) {
    p = 0.0001;
  }
  if (Math.random() < p) {
    console.log(arg);
  }
};


Array.prototype.pushArray = function() {
  var toPush = this.concat.apply([], arguments);
  for (var i = 0, len = toPush.length; i < len; ++i) {
    this.push(toPush[i]);
  }
};

XYZWRenderer.prototype = {

  setSize: function(width, height) {
    this.domElement.width = width;
    this.domElement.height = height;
    this.width = this.domElement.width;
    this.height = this.domElement.height;
  },

  calculateLighting: function(ambient, diffuse, lights, normalWorld, cameraWorld, specular, shininess) {
    var specTotal = new THREE.Color(0x000000);

    for (var l=0, vl = lights.length; l < vl; l++) {
      var light = lights[l];
      if (light instanceof THREE.DirectionalLight) {
        var lightColour = light.color;
        var lightPosition = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld).normalize();
        var lightWeight = Math.max(normalWorld.dot(lightPosition), 0.0);
        ambient.add( new THREE.Color(lightColour).multiplyScalar(lightWeight*light.intensity)); 
        if (shininess > 0) {
          var halfVector = lightPosition.add(new THREE.Vector3().setFromMatrixPosition(cameraWorld).normalize()).normalize();
          var normalToHalf = Math.max(normalWorld.dot(halfVector), 0.0);
          var specWeight = Math.pow(normalToHalf, shininess);
          specTotal.add(new THREE.Color(specular).multiplyScalar(specWeight * 2.0));
        }
      }
    }
    return new THREE.Color(diffuse).multiply(ambient).add(specTotal);
  },

  shadeVertex: function ( src, normal, modelMatrix, viewProjectionMatrix, lights, diffuse, cameraWorld, specular, shininess ) {
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

    var transpose_inverse = new THREE.Matrix4().getInverse(modelMatrix).transpose();
    vertex.normalWorld = new THREE.Vector3().copy(normal).applyMatrix4(transpose_inverse).normalize();

    var ambient = new THREE.Color(0x000000);

    vertex.colour = this.calculateLighting(ambient, diffuse, lights, 
        vertex.normalWorld, cameraWorld, specular, shininess);

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

    var shaded_vertex = function(idx, normal, object, lights) {
      return _this.shadeVertex(object.geometry.vertices[idx], normal, 
          object.matrixWorld, viewProjectionMatrix, lights, object.material.color, camera.matrixWorld,
          object.material.specular, object.material.shininess);
    };

    var lights = [];

    scene.traverse( function (object) {
      if (object instanceof THREE.DirectionalLight) {
        lights.push(object);
      }
    });

    scene.traverse( function ( object ) {
      if (object instanceof THREE.Mesh) {
        var faces = object.geometry.faces;

        for (var v=0, vl=faces.length; v < vl; v++) {
          var face = faces[v];

          var a = shaded_vertex(face.a, face.vertexNormals[0], object, lights);
          var b = shaded_vertex(face.b, face.vertexNormals[1], object, lights);
          var c = shaded_vertex(face.c, face.vertexNormals[2], object, lights);

          if (a.visible || b.visible || c.visible) {
            renderList.push([a,b,c]);
          }
        }
      }
    });

    this.clear_canvas();

    var pixels = [];
    for (var v=0, vl=renderList.length; v < vl; v++) {
      var face = renderList[v];
      var vv1 = this.to_canvas_position(face[0]);
      var vv2 = this.to_canvas_position(face[1]);
      var vv3 = this.to_canvas_position(face[2]);
      pixels.pushArray(_this.drawTriangle(vv1, vv2, vv3));
    }


    pixels.sort(function(a,b) {
      return b.z - a.z;
    });

    var draw_pixel = function(index, stepsize) {
      for (var p=index, pl=pixels.length, i=0; p < pl && i < stepsize; p++, i++) {
        var pixel = pixels[p];
        this.context.fillStyle = pixel.color.getStyle();
        this.context.fillRect(pixel.x,pixel.y,1,1);
      }
      if (index < pixels.length) {
        index = index + stepsize;
        window.setTimeout(function () { draw_pixel.bind(_this)(index, stepsize);}, 100 );
      }
    };
    draw_pixel.bind(_this)(0,8000);
  },

  clear_canvas: function() {
    this.context.fillStyle = "black";
    this.context.fillRect(0, 0, this.domElement.width, this.domElement.height);
  },

  to_canvas_position: function(vertex) {
    vertex.x = (vertex.positionScreen.x / 2.0 + 0.5) * this.domElement.width;
    vertex.y = (vertex.positionScreen.y / -2.0 + 0.5) * this.domElement.height;
    vertex.z = vertex.positionScreen.z;
    return vertex; 
  },

  shadeFragment: function(colour) {
    return colour;
  },

  isInTriangle: function(base, vv0, vv1, x, y) {
        var vv2 = new THREE.Vector2(x,y).sub(base);

        var dot00 = vv0.dot(vv0);
        var dot01 = vv0.dot(vv1);
        var dot02 = vv0.dot(vv2);
        var dot11 = vv1.dot(vv1);
        var dot12 = vv1.dot(vv2);

        var invDenom = 1  / (dot00 * dot11 - dot01 * dot01);


        var s = (dot11 * dot02 - dot01 * dot12) * invDenom; 
        var t = (dot00 * dot12 - dot01 * dot02) * invDenom; 

        var in_triangle = ( (s >= 0) && (t >= 0) && (s + t <= 1));
        return {test: in_triangle, s:s, t:t };
  },

  drawTriangle: function(v1, v2, v3) {
    // calculate bounding box

    var maxX = Math.ceil(Math.max(v1.x, Math.max(v2.x, v3.x))) + 1.0;
    var minX = Math.floor(Math.min(v1.x, Math.min(v2.x, v3.x))) - 1.0;
    var maxY = Math.ceil(Math.max(v1.y, Math.max(v2.y, v3.y))) + 1.0;
    var minY = Math.floor(Math.min(v1.y, Math.min(v2.y, v3.y))) - 1.0;

    var base = new THREE.Vector2(v1.x, v1.y);
    var vv0 = new THREE.Vector2(v2.x, v2.y).sub(base);
    var vv1 = new THREE.Vector2(v3.x, v3.y).sub(base);

    face = new RenderableFace(v1, v2, v3);

    pixels = [];
    for (var x = minX; x <= maxX; x++)
    {
      for (var y = minY; y <= maxY; y++)
      {
        var testpixel = this.isInTriangle(base, vv0, vv1, x, y);


        if (testpixel.test) 
        { 
          pixel = face.render(x,y, testpixel.s, testpixel.t, this.shadeFragment);  
          pixels.push(pixel);
        }
      }
    }
    return pixels;
  }
};

RenderableFace = function(v1, v2, v3) {
  this.v1 = v1;
  this.v2 = v2;
  this.v3 = v3;
};


RenderableFace.prototype = {
  render: function(x, y, s, t, shader) {
    var w = 1 - (s+t);

    var c1s = new THREE.Color().copy(this.v1.colour).multiplyScalar(w); // 1 - (s+t)
    var c2s = new THREE.Color().copy(this.v2.colour).multiplyScalar(s); // 1 - (t+w)
    var c3s = new THREE.Color().copy(this.v3.colour).multiplyScalar(t); // 1 - (w+s)

    var z = this.v1.z * w + this.v2.z * s + this.v3.z * t;

    c1s.add(c2s).add(c3s);    

    //var c = new THREE.Color().copy(this.v1.colour).add(this.v2.colour).add(this.v3.colour).multiplyScalar(0.333);
    return { x:x, y:y, z:z, color: shader(c1s) };
  }
};

