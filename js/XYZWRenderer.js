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

XYZWVertexShader = function(uniforms) {
  this.ambient = uniforms.ambient;
  this.diffuse = uniforms.diffuse;
  this.lights = uniforms.lights;
  this.cameraWorld = uniforms.cameraWorld;
  this.specular = uniforms.specular;
  this.shininess = uniforms.shininess;
  this.modelMatrix = uniforms.modelMatrix;
  this.viewProjectionMatrix = uniforms.viewProjectionMatrix;
};

XYZWVertexShader.prototype = {

  calculateLighting: function(normalWorld) {
    var specTotal = new THREE.Color(0x000000);
    var ambient = new THREE.Color(this.ambient);

    for (var l=0, vl = this.lights.length; l < vl; l++) {
      var light = this.lights[l];
      if (light instanceof THREE.DirectionalLight) {

        var lightColour = light.color;
        var lightPosition = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld).normalize();
        var lightWeight = Math.max(normalWorld.dot(lightPosition), 0.0);
        ambient.add( new THREE.Color(lightColour).multiplyScalar(lightWeight*light.intensity)); 

        if (this.shininess > 0) {
          // this is ported straight from three.js's phong fragment shader
          // https://github.com/mrdoob/three.js/issues/4363 - maybe someone
          // understands it. 
          var halfVector = lightPosition.add(new THREE.Vector3().setFromMatrixPosition(this.cameraWorld).normalize()).normalize();
          var normalToHalf = Math.max(normalWorld.dot(halfVector), 0.0);
          var specWeight = Math.max(Math.pow(normalToHalf, this.shininess), 0.0);
          var inverseColor = new THREE.Color(1 - this.specular.r, 1 - this.specular.g, 1 - this.specular.b);
          var specularNormalization = (this.shininess + 2.0) / 8.0;
          var schlick = new THREE.Color(this.specular).add(inverseColor.multiplyScalar(Math.pow( Math.max(1 - lightPosition.dot(halfVector), 0.0), 5.0)));
          specTotal.add(schlick.multiply(lightColour).multiplyScalar(specWeight).multiplyScalar(lightWeight).multiplyScalar(specularNormalization));
        }

      }
    }
    return new THREE.Color(this.diffuse).multiply(ambient).add(specTotal);
  },

  shade: function(attributes) {
    var vertex = new THREE.RenderableVertex();
    vertex.position.set(attributes.position.x, attributes.position.y, attributes.position.z);

    var position = vertex.position;
    var positionWorld = vertex.positionWorld;
    var positionScreen = vertex.positionScreen;

    positionWorld.copy( position ).applyMatrix4( this.modelMatrix );
    positionScreen.copy( positionWorld ).applyMatrix4( this.viewProjectionMatrix );

    var invW = 1 / positionScreen.w;

    positionScreen.x *= invW;
    positionScreen.y *= invW;
    positionScreen.z *= invW;

    vertex.visible = positionScreen.x >= - 1 && positionScreen.x <= 1 &&
      positionScreen.y >= - 1 && positionScreen.y <= 1 &&
      positionScreen.z >= - 1 && positionScreen.z <= 1;

    var transpose_inverse = new THREE.Matrix4().getInverse(this.modelMatrix).transpose();
    vertex.normalWorld = new THREE.Vector3().copy(attributes.normal).applyMatrix4(transpose_inverse).normalize();

    vertex.colour = this.calculateLighting(vertex.normalWorld);

    return vertex;
  },
};

XYZWFragmentShader = function( uniforms) {
};

XYZWFragmentShader.prototype = {
  shade: function(varyings) {
    return varyings.colour;
  }
};


XYZWRenderer = function ( parameters ) {
  this.parameters = parameters;
  this.domElement = document.createElement("canvas");
  this.width = this.domElement.width;
  this.height = this.domElement.height;
  this.context = this.domElement.getContext( '2d', {} );
};

XYZWRenderer.prototype = {

  setSize: function(width, height) {
    this.domElement.width = width;
    this.domElement.height = height;
    this.width = this.domElement.width;
    this.height = this.domElement.height;
  },

  render: function(scene, camera) {
    var viewMatrix = new THREE.Matrix4(),
    viewProjectionMatrix = new THREE.Matrix4();

    scene.updateMatrixWorld();

    viewMatrix.copy(camera.matrixWorldInverse);
    viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, viewMatrix);

    var lights = [];
    scene.traverse( function (object) {
      if (object instanceof THREE.DirectionalLight) {
        lights.push(object);
      }
    });

    var pixels = [];
    scene.traverse( function ( object ) {
      if (object instanceof THREE.Mesh) {

        var uniforms = {
          modelMatrix: object.matrixWorld, 
          viewProjectionMatrix: viewProjectionMatrix,
          cameraWorld: camera.matrixWorld,
          lights: lights,
          ambient: new THREE.Color(0x000000),
          diffuse: object.material.color,
          specular: object.material.specular,
          shininess: object.material.shininess
        };

        var vertex_shader = new XYZWVertexShader(uniforms);
        var fragment_shader = new XYZWFragmentShader(uniforms);

        var faces = object.geometry.faces;

        for (var v=0, vl=faces.length; v < vl; v++) {
          var face = faces[v];

          var a = vertex_shader.shade({position: object.geometry.vertices[face.a], normal: face.vertexNormals[0]});
          var b = vertex_shader.shade({position: object.geometry.vertices[face.b], normal: face.vertexNormals[1]});
          var c = vertex_shader.shade({position: object.geometry.vertices[face.c], normal: face.vertexNormals[2]});

          if (a.visible || b.visible || c.visible) {
            var vv1 = this.to_canvas_position(a);
            var vv2 = this.to_canvas_position(b);
            var vv3 = this.to_canvas_position(c);
            pixels.pushArray(this.drawTriangle(vv1, vv2, vv3, fragment_shader));
          }
        }
      }
    }.bind(this));

    pixels.sort(function(a,b) {
      return b.z - a.z;
    });

    this.clear_canvas();
    for (var p=0, pl=pixels.length; p < pl; p++) {
      var pixel = pixels[p];
      this.context.fillStyle = pixel.color.getStyle();
      this.context.fillRect(pixel.x,pixel.y,1,1);
    }
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

    var inTriangle = ( (s >= 0) && (t >= 0) && (s + t <= 1));
    return {test: inTriangle, s: s, t: t };
  },

  drawTriangle: function(v1, v2, v3, shader) {
    var maxX = Math.ceil(Math.max(v1.x, Math.max(v2.x, v3.x))) + 1.0;
    var minX = Math.floor(Math.min(v1.x, Math.min(v2.x, v3.x))) - 1.0;
    var maxY = Math.ceil(Math.max(v1.y, Math.max(v2.y, v3.y))) + 1.0;
    var minY = Math.floor(Math.min(v1.y, Math.min(v2.y, v3.y))) - 1.0;

    var base = new THREE.Vector2(v1.x, v1.y);
    var vv0 = new THREE.Vector2(v2.x, v2.y).sub(base);
    var vv1 = new THREE.Vector2(v3.x, v3.y).sub(base);

    face = new RenderingFace(v1, v2, v3);

    pixels = [];
    for (var x = minX; x <= maxX; x++)
    {
      for (var y = minY; y <= maxY; y++)
      {
        var testpixel = this.isInTriangle(base, vv0, vv1, x, y);
        if (testpixel.test) 
        { 
          pixel = face.shade_pixel(x, y, testpixel.s, testpixel.t, shader);  
          pixels.push(pixel);
        }
      }
    }
    return pixels;
  }
};

RenderingFace = function(v1, v2, v3) {
  this.v1 = v1;
  this.v2 = v2;
  this.v3 = v3;
};

RenderingFace.prototype = {

  interpolateObject: function(attr, s, t) {
    var w = 1 - (s+t);
    var c1s = this.v1[attr].clone().multiplyScalar(w); // 1 - (s+t)
    var c2s = this.v2[attr].clone().multiplyScalar(s); // 1 - (t+w)
    var c3s = this.v3[attr].clone().multiplyScalar(t); // 1 - (s+w)
    c1s.add(c2s).add(c3s);    
    return c1s;
  },

  interpolateScalar: function(attr, s, t) {
    var w = 1 - (s+t);
    return this.v1[attr] * w + this.v2[attr] * s + this.v3[attr] * t;
  },

  shade_pixel: function(x, y, s, t, shader) {
    var color = shader.shade({ colour: this.interpolateObject("colour", s, t)});
    return { 
      x: x, 
      y: y, 
      z: this.interpolateScalar("z", s, t), 
      color: color 
    }; 
  }
};

