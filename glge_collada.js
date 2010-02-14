/*
GLGE WebGL Graphics Engine
Copyright (c) 2010, Paul Brunt
All rights reserved.
 
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of GLGE nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.
 
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL PAUL BRUNT BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
 
 
 (function(GLGE){
/**
* Class to represent a collada object
* @augments GLGE.Group
*/
GLGE.Collada=function(){
	this.objects=[];
};
GLGE.augment(GLGE.Group,GLGE.Collada);

/**
* function to get the element with a specified id
* @param {string} id the id of the element
* @private
*/
GLGE.Collada.prototype.getElementById=function(id){
	var tags=this.getElementsByTagName("*");
	for(var i=0; i<tags.length;i++){
		if(tags[i].getAttribute("id")==id){
			return tags[i];
			break;
		}
	}
}
/**
* function extracts a javascript array from the document
* @param {DOM Element} noe the value to parse
* @private
*/
GLGE.Collada.prototype.parseArray=function(node){
	var child=node.firstChild;
	var prev="";
	var output=[];
	var currentArray;
	while(child){
		currentArray=(prev+child.nodeValue).replace(/\s+/g," ").replace(/^\s+/g,"").split(" ");
		child=child.nextSibling;
		if(currentArray[0]=="") currentArray.unshift();
		if(child) prev=currentArray.pop();
		output=output.concat(currentArray);
	}

	return output;
};
/**
* loads an collada file from a given url
* @param {DOM Element} node the value to parse
*/
GLGE.Collada.prototype.setDocument=function(url){
	var req = new XMLHttpRequest();
	if(req) {
		req.docurl=url;
		req.docObj=this;
		req.onreadystatechange = function() {
			if(this.readyState  == 4)
			{
				if(this.status  == 200 || this.status==0){
					this.responseXML.getElementById=this.docObj.getElementById;
					this.docObj.loaded(this.docurl,this.responseXML);
				}else{ 
					GLGE.error("Error loading Document: "+this.docurl+" status "+this.status);
				}
			}
		};
		req.open("GET", url, true);
		req.send("");
	}	
};
/**
* gets data for a given source element
* @param {string} id the id of the source element
* @private
*/
GLGE.Collada.prototype.getSource=function(id){
	var element=this.xml.getElementById(id);
	var value;
	if(element.tagName=="vertices"){
		value=this.getSource(element.getElementsByTagName("input")[0].getAttribute("source").substr(1));
	}else{
		value=this.parseArray(element.getElementsByTagName("float_array")[0]);
		stride=element.getElementsByTagName("accessor")[0].getAttribute("stride");
		value={array:value,stride:stride};
	}
	return value;
};
 
GLGE.Collada.prototype.getMeshes=function(id){
	var i,n;
	var mesh;
	var inputs;
	var inputArray;
	var faces;
	var outputData;
	var rootNode=this.xml.getElementById(id);
	var meshNode=rootNode.getElementsByTagName("mesh")[0];
	var meshes=[];
	
	
	//create a mesh for each set of faces
	var triangles=meshNode.getElementsByTagName("triangles");
	for(i=0;i<triangles.length;i++){
		//go though the inputs to get the data layout
		inputs=triangles[i].getElementsByTagName("input");
		inputArray=[];
		for(n=0;n<inputs.length;n++){
			inputs[n].data=this.getSource(inputs[n].getAttribute("source").substr(1));
			inputArray[inputs[n].getAttribute("offset")]=inputs[n];
		}
		//get the face data and push the data into the mesh
		faces=this.parseArray(triangles[i].getElementsByTagName("p")[0]);
		outputData={};
		var set;
		for(j=0;j<faces.length;j=j+inputArray.length){
			for(n=0;n<inputArray.length;n++){
				var block=inputArray[n].getAttribute("semantic");
				if(block=="TEXCOORD"){
					set=inputArray[n].getAttribute("set");
					if(!set) set=0;
					block=block+set;
				}
				if(!outputData[block]) outputData[block]=[];
				for(k=0;k<inputArray[n].data.stride;k++){
					outputData[block].push(inputArray[n].data.array[parseInt(faces[j+n])*inputArray[n].data.stride+k]);
				}
			}
		}
		//create faces array
		faces=[];
		for(n=0;n<outputData.VERTEX.length/3;n++) faces.push(n);
		//create mesh
		var trimesh=new GLGE.Mesh();
		trimesh.setPositions(outputData.VERTEX);
		trimesh.setNormals(outputData.NORMAL);
		if(outputData.TEXCOORD0) trimesh.setUV(outputData.TEXCOORD0);
		if(outputData.TEXCOORD1) trimesh.setUV2(outputData.TEXCOORD1);
		trimesh.setFaces(faces);
		trimesh.matName=triangles[i].getAttribute("material");
		meshes.push(trimesh);
	}
	return meshes;
};
GLGE.Collada.prototype.getSampler=function(profile,sid){
	var params=profile.getElementsByTagName("newparam");
	for(var i=0;i<params.length;i++){
		if(params[i].getAttribute("sid")==sid){
			//only do 2d atm.
			return params[i].getElementsByTagName("sampler2D")[0].getElementsByTagName("source")[0].firstChild.nodeValue;
		}
	}
}
GLGE.Collada.prototype.getSurface=function(profile,sid){
	var params=profile.getElementsByTagName("newparam");
	for(var i=0;i<params.length;i++){
		if(params[i].getAttribute("sid")==sid){
			return params[i].getElementsByTagName("surface")[0].getElementsByTagName("init_from")[0].firstChild.nodeValue;
		}
	}
}
//gets the material from an id
GLGE.Collada.prototype.getMaterial=function(id){
	var materialNode=this.xml.getElementById(id);
	var effectid=materialNode.getElementsByTagName("instance_effect")[0].getAttribute("url").substr(1);
	var effect=this.xml.getElementById(effectid);
	var common=effect.getElementsByTagName("profile_COMMON")[0];
	//glge only supports one technique currently so try and match as best we can
	var technique=common.getElementsByTagName("technique")[0];
	
	var returnMaterial=new GLGE.Material();
	returnMaterial.setSpecular(0);
	
	var child;
	var color;
	var textureImage;
	
	//do diffuse
	var diffuse=technique.getElementsByTagName("diffuse");
	if(diffuse.length>0){
		child=diffuse[0].firstChild;
		do{
			switch(child.tagName){
				case "color":
					color=child.firstChild.nodeValue.split(" ");
					returnMaterial.setColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "texture":
					var imageid=this.getSurface(common,this.getSampler(common,child.getAttribute("texture")));
					textureImage=this.xml.getElementById(imageid).getElementsByTagName("init_from")[0].firstChild.nodeValue;
					var texture=new GLGE.Texture(textureImage);
					returnMaterial.addTexture(texture);
					returnMaterial.addMaterialLayer(new GLGE.MaterialLayer(texture,GLGE.M_COLOR,GLGE.UV1));
					break;
			}
		}while(child=child.nextSibling);
	}
	
	//do shininess
	var shininess=technique.getElementsByTagName("shininess");
	if(shininess.length>0){
		returnMaterial.setSpecular(1);
		child=technique.getElementsByTagName("shininess")[0].firstChild;
		do{
			switch(child.tagName){
				case "float":
					returnMaterial.setShininess(parseFloat(child.firstChild.nodeValue))
					break;
				case "texture":
					var imageid=this.getSurface(common,this.getSampler(common,child.getAttribute("texture")));
					textureImage=this.xml.getElementById(imageid).getElementsByTagName("init_from")[0].firstChild.nodeValue;
					var texture=new GLGE.Texture(textureImage);
					returnMaterial.addTexture(texture);
					returnMaterial.addMaterialLayer(new GLGE.MaterialLayer(texture,GLGE.M_SHINE,GLGE.UV1));
					break;
			}
		}while(child=child.nextSibling);
	}
	
	//do spec color
	var specular=technique.getElementsByTagName("specular");
	if(specular.length>0){
		returnMaterial.setSpecular(1);
		child=specular[0].firstChild;
		do{
			switch(child.tagName){
				case "color":
					color=child.firstChild.nodeValue.split(" ");
					returnMaterial.setSpecularColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "texture":
					var imageid=this.getSurface(common,this.getSampler(common,child.getAttribute("texture")));
					textureImage=this.xml.getElementById(imageid).getElementsByTagName("init_from")[0].firstChild.nodeValue;
					var texture=new GLGE.Texture(textureImage);
					returnMaterial.addTexture(texture);
					returnMaterial.addMaterialLayer(new GLGE.MaterialLayer(texture,GLGE.M_SPECCOLOR,GLGE.UV1));
					break;
			}
		}while(child=child.nextSibling);
	}

	//do reflectivity
	var reflect=technique.getElementsByTagName("reflectivity");
	if(reflect.length>0){
		child=reflect[0].firstChild;
		do{
			switch(child.tagName){
				case "float":
					returnMaterial.setReflectivity(parseFloat(child.firstChild.nodeValue))
					break;
				case "texture":
					var imageid=this.getSurface(common,this.getSampler(common,child.getAttribute("texture")));
					textureImage=this.xml.getElementById(imageid).getElementsByTagName("init_from")[0].firstChild.nodeValue;
					var texture=new GLGE.Texture(textureImage);
					returnMaterial.addTexture(texture);
					returnMaterial.addMaterialLayer(new GLGE.MaterialLayer(texture,GLGE.M_REFLECT,GLGE.UV1));
					break;
			}
		}while(child=child.nextSibling);
	}
	
	//do reflectivity
	var transparent=technique.getElementsByTagName("transparent");
	if(transparent.length>0){
		child=transparent[0].firstChild;
		do{
			switch(child.tagName){
				case "float":
					var alpha=parseFloat(child.firstChild.nodeValue);
					if(alpha<1){
						returnMaterial.setAlpha(parseFloat(child.firstChild.nodeValue));
						returnMaterial.trans=true;
					}
					break;
				case "texture":
					var imageid=this.getSurface(common,this.getSampler(common,child.getAttribute("texture")));
					textureImage=this.xml.getElementById(imageid).getElementsByTagName("init_from")[0].firstChild.nodeValue;
					var texture=new GLGE.Texture(textureImage);
					returnMaterial.addTexture(texture);
					returnMaterial.addMaterialLayer(new GLGE.MaterialLayer(texture,GLGE.M_ALPHA,GLGE.UV1));
					returnMaterial.trans=true;
					break;
			}
		}while(child=child.nextSibling);
	}
	
	
	return returnMaterial;
};

GLGE.Collada.prototype.getInstanceGeometry=function(node){
	var meshes=this.getMeshes(node.getAttribute("url").substr(1));
	var materials=node.getElementsByTagName("instance_material");
	var objMaterials={};
	for(var i=0; i<materials.length;i++){
		mat=this.getMaterial(materials[i].getAttribute("target").substr(1));
		objMaterials[materials[i].getAttribute("symbol")]=mat;
	}
	//create GLGE object
	var obj=new GLGE.Object();
	for(i=0; i<meshes.length;i++){
		if(objMaterials[meshes[i].matName].trans){
			obj.setZtransparent(true);
		}
		obj.addMultiMaterial(new GLGE.MultiMaterial(meshes[i],objMaterials[meshes[i].matName]));
	}
	return obj;
}
GLGE.Collada.prototype.getNode=function(node){
	var newGroup=new GLGE.Group();
	var child=node.firstChild;
	var matrix=GLGE.identMatrix();
	var data;
	do{
		switch(child.tagName){
			case "node":
				newGroup.addGroup(this.getNode(child));
				break;
			case "instance_node":
				newGroup.addGroup(this.getNode(this.xml.getElementById(child.getAttribute("url").substr(1))));
				break;
			case "instance_geometry":
				newGroup.addObject(this.getInstanceGeometry(child));
				break;
			case "matrix":
				matrix=new GLGE.Mat(this.parseArray(child));
				break;
			case "translate":
				data=this.parseArray(child);
				matrix=matrix.x(GLGE.translateMatrix(data[0],data[1],data[2]));
				break;
			case "rotate":
				data=this.parseArray(child);
				matrix=matrix.x(GLGE.angleAxis(data[3]/180*3.14159,[data[0],data[1],data[2]]));
				break;
		}
	}while(child=child.nextSibling);
	newGroup.setLoc(matrix.data[3],matrix.data[7],matrix.data[11]);
	newGroup.setRotMatrix(new GLGE.Mat([matrix.data[0], matrix.data[1], matrix.data[2], 0,
								matrix.data[4], matrix.data[5], matrix.data[6], 0,
								matrix.data[8], matrix.data[9], matrix.data[10], 0,
								0, 0, 0, 1]));
	return newGroup;
};

GLGE.Collada.prototype.initVisualScene=function(){
	var sceneid=this.xml.getElementsByTagName("scene")[0].getElementsByTagName("instance_visual_scene")[0].getAttribute("url").substr(1);
	var sceneroot=this.xml.getElementById(sceneid);
	this.addGroup(this.getNode(sceneroot));
};
 
GLGE.Collada.prototype.loaded=function(url,xml){
	this.xml=xml;
	this.initVisualScene();
	//this.getMeshes("mesh5-geometry");
}

GLGE.Scene.prototype.addCollada=GLGE.Scene.prototype.addGroup;
})(GLGE);