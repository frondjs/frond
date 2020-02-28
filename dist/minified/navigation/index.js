const EventEmitter=require("event-emitter-object"),LocalStoragePro=require("local-storage-pro");function Navigation(a,b){EventEmitter.call(this,a),this.kit=null,this.id=b.id,this.views=b.views||[],this.defaultViewID=b.defaultView||"start",this.defaultLocale=b.defaultLocale||null,this.activeLocale=b.activeLocale||this.defaultLocale||null,this.basePath=b.basePath||"/",this.additionalViewProps=b.additionalViewProps||[],this.viewsAreStaticByDefault=!b.hasOwnProperty("viewsAreStaticByDefault")||b.viewsAreStaticByDefault,this.ignoreLocalePathForDefaultLocale=!b.hasOwnProperty("ignoreLocalePathForDefaultLocale")||b.ignoreLocalePathForDefaultLocale,this.manipulateAddressBar=!!b.hasOwnProperty("manipulateAddressBar")&&b.manipulateAddressBar,this.isLocalFilesystem="file:"==window.location.protocol,this.foundLocales=[],this.history=[],this.storeKeyPrefix="FROND_ROUTER_"+b.id.toUpperCase()+"_"}Navigation.prototype=Object.create(EventEmitter.prototype),Navigation.prototype.constructor=Navigation,Navigation.prototype.browserStore=new LocalStoragePro,Navigation.prototype.build=function(a){const b=this;if(!b.kit.isArray(b.views)||b.kit.isEmpty(b.views))return;if(!b.kit.isObject(a))return;const c=b.kit.isNotEmpty(b.additionalViewProps)&&b.kit.isArray(b.additionalViewProps)?b.additionalViewProps:[],d=[],e=b.views.length;for(let f=0;f<e;f++){const e=b.views[f],g=b.kit.getProp(e,"id"),h=b.kit.getProp(e,"component",g),i=b.kit.getProp(a,h);if(!b.kit.isEmpty(g)&&i){const a={id:g,component:i,static:b.kit.getProp(e,"static",b.viewsAreStaticByDefault),pathName:b.kit.getProp(e,"pathName",""),parent:b.kit.getProp(e,"parent",null),authRequired:b.kit.getProp(e,"authRequired",!1),metadata:b.kit.getProp(e,"metadata",{}),locale:b.kit.getProp(e,"locale",b.defaultLocale)};0<c.length&&(a.additionalProps=c.reduce(function(a,c){return a[c]=b.kit.getProp(e,c,null),a},{})),-1===b.foundLocales.indexOf(a.locale)&&b.foundLocales.push(a.locale),d.push(a)}}const f=[],g=d.length;for(let c=0;c<g;c++){const a=d[c],e=[a.id],g=[a.pathName];for(let c=a.parent;!b.kit.isEmpty(c);){const f=d.filter(b=>b.id==c&&b.locale==a.locale);if(b.kit.isEmpty(f))break;const h=f[0];g.push(h.pathName),e.push(h.id),c=h.parent}!b.kit.isEmpty(b.defaultLocale)&&b.defaultLocale!=a.locale&&b.ignoreLocalePathForDefaultLocale&&g.push(a.locale.toLowerCase()),a.roots=e,a.fullpath=b.basePath+g.filter(a=>0<a.length).reverse().join("/"),f.push(a)}return b.views=[].concat(f),b},Navigation.prototype.matchPath=function(a){const b=this,c=b.getViewByID(b.defaultViewID,b.activeLocale),d=b.browserStore.getItem(b.storeKeyPrefix+"RESTORE_VIEW_ID");if(!b.kit.isEmpty(d)){const a=b.getViewByID(d,b.activeLocale);if(b.browserStore.removeItem(b.storeKeyPrefix+"RESTORE_VIEW_ID"),a)return a}let e=null;if(!b.kit.isEmpty(a))e=a;else if(b.useAddressBar())try{const a=new URL(window.location.href);e=a.pathname}catch(a){}else e=b.browserStore.getItem(b.storeKeyPrefix+"ACTIVE_PATH");if(b.kit.isEmpty(e))return c;const f=e.split("/"),g=f.filter(a=>0<a.length).join("/"),h=b.basePath+g,j=b.views.length;for(let c=0;c<j;c++){const a=b.views[c];if(h==a.fullpath)return a;if(!b.kit.isEmpty(b.defaultLocale)&&b.defaultLocale==a.locale&&b.ignoreLocalePathForDefaultLocale){const c=b.basePath+b.defaultLocale+"/"+g;if(c==a.fullpath)return a}}return c},Navigation.prototype.getViewByID=function(a,b=null){const c=this,d=c.views.filter(function(d){return c.kit.isNotEmpty(b)&&-1!==c.foundLocales.indexOf(b)?d.id==a&&d.locale==b:c.kit.isNotEmpty(c.activeLocale)?d.id==a&&d.locale==c.activeLocale:c.kit.isNotEmpty(c.defaultLocale)?d.id==a&&d.locale==c.defaultLocale:d.id==a});return c.kit.isNotEmpty(d)?d[0]:void 0},Navigation.prototype.shift=function(a,b=null){const c=this;if(!c.kit.isString(a))return;const d=c.getActiveView(),e=c.kit.isEmpty(b)||-1===c.foundLocales.indexOf(b)?c.activeLocale:b,f=c.getViewByID(a,e);if(!c.kit.isEmpty(f)){if(c.emit("beforeShift",[d,f]),c.history.unshift(f),c.useAddressBar())try{window.history.pushState(null,null,f.fullpath)}catch(a){}const a=c.getActiveView();return c.browserStore.setItem(c.storeKeyPrefix+"ACTIVE_PATH",a.fullpath),c.emit("afterShift",[a,c.getPrevView()]),c.kit.isEmpty(d)&&c.emit("initialShift",[a]),!0}},Navigation.prototype.useAddressBar=function(){return!0===this.manipulateAddressBar&&!1===this.isLocalFilesystem},Navigation.prototype.getActiveView=function(){return 0<this.history.length?this.history[0]:null},Navigation.prototype.getPrevView=function(){return 1<this.history.length?this.history[1]:null},Navigation.prototype.getLink=function(a,b,c){const d=this;if(!d.kit.isString(a))return;const e=!d.kit.isEmpty(b)&&d.kit.isString(b)?b:"",f=d.kit.isEmpty(c)?d.getActiveView().locale:c,g=d.getViewByID(a,f);return d.kit.isEmpty(g)?void 0:e+g.fullpath},Navigation.prototype.findAlternates=function(a,b){const c=this;if(!c.kit.isString(a)||c.kit.isEmpty(c.defaultLocale))return[];const d=c.kit.isEmpty(b)?"":b,e=c.views.filter(b=>b.id==a);if(c.kit.isEmpty(e))return[];/[-_]/;return e.map(function(a){return{lang:a.locale,url:d+a.fullpath}})},Navigation.prototype.genHierarchicalMap=function(a,b){function c(a){const b=d.views.filter(b=>b.parent==a.id&&b.locale==e);return a.children=d.kit.isEmpty(b)?[]:b.map(a=>c(a)),a}const d=this,e=d.kit.isEmpty(b)?d.getActiveView().locale:b;return d.views.filter(b=>b.locale==e&&(d.kit.isEmpty(a)?d.kit.isEmpty(b.parent):b.parent==a)).map(a=>c(a))},Navigation.prototype.breadcrumb=function(a,b){const c=this;return a.roots.reverse().map(function(d){const e=c.getViewByID(d,a.locale);return{url:b+e.fullpath,title:e.metadata.title}})},module.exports=Navigation;