const EventEmitter=require("event-emitter-object");function Network(a,b){EventEmitter.call(this,a),this.id=b.id,this.resolver=b.resolver}Network.prototype=Object.create(EventEmitter.prototype),Network.prototype.constructor=Network,Network.prototype.request=function(a,b){const c=this;b.emit("beforeFetch"),c.emit("beforeFetch"),c.resolver.apply(c,[a]).then(function(a){b.updateState({_data:a}),b.emit("afterFetch"),c.emit("afterFetch")}).catch(function(a){c.emit("error",[a])})},module.exports=Network;