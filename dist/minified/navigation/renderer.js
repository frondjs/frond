module.exports=function(){if(!this.getRouter())return[""];const a=this.getRouter().getActiveView();if(!a)return[""];const b=a.component;return"function"==typeof b?b():b};