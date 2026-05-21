﻿﻿﻿/*
 * 최종 작성일  2018-12-07
 **/
var CooconLicense = { "MstCompNo" : "5568800909", "SubCompNo" : "5568800909", "ProductNo" : "00000014" };

/* 스크래핑 모듈 생성 */
var CooconiSASNX = new iBASENXModule();

function iBASENXModule() {
	this.LOG_MODE = true;
	
	/** 설치 모듈 실행 버전 */
	this.CurrentVersion = "2023.4.7.0"; 
	this.RUNLEVEL = 1;//0:사용자,1:관리자
	this.RunTimeout = 5*60*1000;//Uac 허용 Timeout 시간
	this.UpdateTimeout = 3*60*1000;//Update 요청 Timeout
	
	/** 서비스 상태 확인 */
	this.WebProtocol = "https";
	this.HostName = "ibasews.coocon.co.kr";
	this.LocalPort = "14101";
	this.ServiceURL = this.WebProtocol + "://" + this.HostName + ":"+ this.LocalPort + "/";
	
	/** 소켓 연결정보 */
	this.SocketHostName = "ibasews.coocon.co.kr";
	this.SocketPort = "14102";
	this.SocketProtocol = "wss";
	this.SocketURL = this.SocketProtocol + "://" + this.SocketHostName + ":"+ this.SocketPort + "/";
	this.License = CooconLicense;
	
	this.FEB = {};/* 소켓 객체 */
	this.Reqmsg = [];/* 요청데이터 */
	this.ReqmsgCnt = [];/* 요청데이터 */
	this.ResultList=[];
	this.encMode = true;
	this.OpenUid = null;
	this.OpenAction = null;
	this.ThreadLength = 1;
	this.ProcDisplay = false;
	
	this.threadWorkCheckingArray = [];
	this.resultArray = [];
	this.ReqmsgCntNumber = 0;
	this.totalInput = 1;
	
	this.null2void=function(msg){
		if(msg==null)return "";
		return msg;
	};
	
	/**
	 *  결과 콜백
	 */
	this.ResultCallback = [];
	this.OpenCallback = null;
	this.ConnectCallback = null;
	this.initCallback = null;
	this.CertListCallback = null;
	
	/**
	 *  입출력 데이터 초기화 
	 */
	this.clearData = function() {
		this.Reqmsg = [];
		this.ResultCallback = [];
	};

	this.getNatural = function(el) {
		var img = new Image();
		img.src = el.src;
		return { width : img.width, height : img.height};
	};

	this.randomString = function(len) {
		var arr = [ "0", "a", "b", "c", "d", "e", "f", "g", "h", "i", "7", "8",
				"9", "j", "k", "l", "4", "5", "6", "m", "n", "o", "p", "q",
				"r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C",
				"D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O",
				"P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "1",
				"2", "3" ];
		var rtn = "";
		for (var i = 0; i < len; i++) {
			rtn += arr[Math.ceil(Math.random() * arr.length -1)];
		}
		return rtn;
	};

	this.setUidAction = function(Uid, Action) {
		var _this=this;
		_this.OpenUid = _this.null2void(Uid);
		_this.OpenAction = _this.null2void(Action);
	};
	
	/* WebSocket Connection */
	this.connect = function(callback) {
		var _this = this;
		
		_this.log("Connect");
		
		_this.ConnectCallback = callback;
		
		//이미 연결된 후
		if (_this.FEB.socket != null &&  _this.FEB.socket.readyState == WebSocket2.OPEN) {
			if (callback != null && typeof callback == "function") {
				_this.ConnectCallback();
				_this.ConnectCallback = null;
				return;
			}
		}else {
			if(_this.FEB.socket == null || _this.FEB.socket.OPEN == null ||  _this.FEB.socket.OPEN != 1){
				_this.log("new Socket Connnection");
				_this.log(_this.SocketURL);
				this.FEB.socket = new WebSocket2(_this.SocketURL);
				/* 웹 소켓 Open 핸들러 */
				this.FEB.socket.onopen = function() {
					_this.log("WebSocket onopen");
					if(  _this.ConnectCallback!= null && typeof _this.ConnectCallback == "function"){
						_this.ConnectCallback(true);
						_this.ConnectCallback = null;
					}
				};
				/* 웹 소켓 Error 핸들러 */
				this.FEB.socket.onerror = function(e) {
					_this.FEB = {};
					if( _this.ConnectCallback!= null && typeof _this.ConnectCallback == "function"){
						_this.ConnectCallback(false);
						_this.ConnectCallback = null;
					}
				};
	
				/* 웹 소켓 Close 핸들러 */
				this.FEB.socket.onclose = function() {
					_this.log("Socket close");
					_this.FEB = {};
				};
	
				/* 웹 소켓 Message 핸들러 */
				this.FEB.socket.onmessage = function(message) {
					var data;
					try {
						_this.log("Receive Message::"+message.data);
						data = JSON.parse(  message.data );
						var msg = _this.null2void( data['Msg'] ).toUpperCase();
						if(_this.callbackHandle[msg] == null){
							console.log('정의되지 않은 메시지 입니다. 관리자에게 문의하시기 바랍니다. (개발계 전용 메시지)');
							return;
						}
		                _this.callbackHandle[msg](data);
					} catch (e) {
						console.error(e);
						console.log("응답결과  처리오류 입니다. (개발계 전용 메시지)");
						return;
					}
				};
				
			}

		}
		
	};
	
	
	var _super = this;
	var isSaleExpense = window.location.href.includes('einv_0001_000.act') ||  window.location.href.includes('einv_0001_001.act') ;
	
	this.callbackHandle={		
		"OPEN":function(msg){
			_super.log("OPEN Handle:"+JSON.stringify( msg ) );
			if( _super.OpenCallback  != null  && typeof _super.OpenCallback =="function") {
				_super.OpenCallback(msg);
				_super.OpenCallback=null;
			}
		},
		"RUN":function(msg){
			_super.log("RUN Handle:"+JSON.stringify( msg ) );
		},
		"CANCELALL":function(msg){
			_super.log("CANCELALL Handle:"+JSON.stringify( msg ) );
			
			for(var i=0; i<_super.ThreadLength; i++){
				$(".caution_box #progressbar_" + i).val("100");
				$(".caution_box #progressbar_" + i).text("100 %");
			}
			$(".caution_box #okcancel_btn").html("확인");
		},
		"CERTLIST":function(msg){
			if( _super.CertListCallback != null && typeof _super.CertListCallback=="function"){
				_super.CertListCallback( msg.Result );
			}
		},
		"CANCEL":function(msg){
			_super.log("CANCEL Handle:"+JSON.stringify( msg ) );
		},
		"ONSTATUSCHANGED":function(msg){
				
			if( _super.ProcDisplay ){
				/**
				 * Status : 1, 2,3,10
				 * proc_module_cnt_{i} : 
				 * proc_job_cnt_{i}:전체 건수
				 * progressbar_{i} : 진행바
				 */
				var idx = msg.ThreadIndex;
				var len = _super.ResultList[idx].ResultList.length;
				
				var module = _super.Reqmsg[idx][len].Module;
				var job = _super.Reqmsg[idx][len].Job;
				
				$(".caution_box #proc_module_cnt_" + msg.ThreadIndex).text(module);
				$(".caution_box #proc_job_cnt_" + msg.ThreadIndex).text(job);
				
				$(".caution_box #progressbar_" + msg.ThreadIndex).val(msg.Progress);
				$(".caution_box #progressbar_" + msg.ThreadIndex).text(c.Progress+" %");
				
			}
			
			//Need to call below function for updating the progress rate
			if(typeof(trns_0001) == "object" && typeof(trns_0001.loadingProgressBar) == "function"){
				trns_0001.loadingProgressBar(msg.Progress, msg.status)
			}
			/*else if(typeof(trns_0002_001) == "object" && typeof(trns_0002_001.loadingProgressBar) == "function"){
				trns_0002_001.loadingProgressBar(msg.Progress, msg.status)
			}*/

		},"ONCOMPLETED":function(msg){
			_super.log("ONCOMPLETED Handle:"+JSON.stringify( msg ) );
			
			var idx = msg.ThreadIndex;
			var len = _super.ResultList[idx].ResultList.length;
			var pResult=JSON.parse(msg.Result);
			_super.threadWorkCheckingArray.push(parseInt(idx));
			var _ocallback = {};			
			if(pResult.Output != null){
				var o= {};
				o['Module']= pResult['Module'];
				o['Class']= pResult['Class'];
				o['Job']= pResult['Job'];
				o['Input']=pResult.Input;
				o['Output']=pResult.Output;
				_super.ResultList[idx].ResultList.push(o);
				_super.resultArray.push(o);
				_ocallback = o;
			}else{
				var o ={"Module":pResult['Module'],"Class":pResult['Class'],"Job":pResult['Job'],'Result':{}, "Output":{"ErrorCode":pResult.ErrorCode,"ErrorMessage": pResult.ErrorMessage}};
				o['Input']=pResult.Input;
				_super.ResultList[idx].ResultList.push(o);
				_super.resultArray.push(o);
				_ocallback = o;
			}
			
			/**
			 * 에러 메시지 Display
			 */
			if(_super.ProcDisplay){
				$(".caution_box #progressbar_" + msg.ThreadIndex).val("100");
				$(".caution_box #progressbar_" + msg.ThreadIndex).text("100 %");
				
				var module = _super.Reqmsg[idx][len].Module;
				var job = _super.Reqmsg[idx][len].Job;
				
				$(".caution_box #proc_module_cnt_" + msg.ThreadIndex).text(module);
				$(".caution_box #proc_job_cnt_" + msg.ThreadIndex).text(job);
				try{
					if(pResult.Output != null){
						var output = pResult.Output;
						if(output.ErrorCode != null && output.ErrorCode != "00000000" && _super.PMSelector !="" ){
							$(_super.PMSelector +" #errMsgLayer").show();
							$(_super.PMSelector +" #errMsgBox").append("<p class='txt_b'>"+ module+"("+ job + ")</p>");
							$(_super.PMSelector +" #errMsgBox").append( "<p>오류코드 :" + output.ErrorCode + " 오류메시지:"+ output.ErrorMessage + "</p>");
						}	
					}else{
						//엔진 오류응답의 경우
						_super.log("Error::"+pResult.ErrorMessage );
						if(pResult.ErrorCode != null && pResult.ErrorCode != "00000000" && _super.PMSelector !="" ){
							$(_super.PMSelector +" #errMsgLayer").show();
							$(_super.PMSelector +" #errMsgBox").append("<p class='txt_b'>"+ module+"("+ job + ")</p>");
							$(_super.PMSelector +" #errMsgBox").append( "<p>오류코드 :" + pResult.ErrorCode + " 오류메시지:"+ pResult.ErrorMessage + "</p>");
						}
					}
				}catch(e){
				}
			}
			var tmpReqmsg = _super.Reqmsg[idx].filter(function(x){
				return x !== undefined;
			});
			if(isSaleExpense){
				
				if( _super.resultArray.length == _super.totalInput ){ 
				/*최종 완료일 경우만 확인 버튼 */
				_super.callbackCnt++;
				if(_super.callbackCnt = _super.ThreadLength){
					$(".caution_box #okcancel_btn").html("확인");
					_super.callbackCnt=0;
				}
				/* Display 없을경우 바로 결과 콜백 */
				if(!_super.ProcDisplay){
					if( _super.ResultCallback[idx] != null && typeof  _super.ResultCallback[idx] == "function"){
						_super.ResultCallback[idx]( _super.resultArray  , idx);
					}
				}
				}else{
					if(typeof(_v2nxisas.job_callback) == 'function'){
						_v2nxisas.job_callback(_ocallback);
					}				
				}
				
			}else{
					if(_super.ResultList[idx].ResultList.length == tmpReqmsg.length){
					/*최종 완료일 경우만 확인 버튼 */
					_super.callbackCnt++;
					if(_super.callbackCnt = _super.ThreadLength){
						$(".caution_box #okcancel_btn").html("확인");
						_super.callbackCnt=0;
					}
					/* Display 없을경우 바로 결과 콜백 */
					if(!_super.ProcDisplay){
						if( _super.ResultCallback[idx] != null && typeof  _super.ResultCallback[idx] == "function"){
							_super.ResultCallback[idx]( _super.ResultList[idx].ResultList  , idx);
						}
					}
				}else{
					if(typeof(_v2nxisas.job_callback) == 'function'){
						_v2nxisas.job_callback(_ocallback);
					}				
					if(_super.sendFlag){
						_super.executeRun(Number(idx));
					}
				}
				
			}
		
			
			//Need to call below function for updating the progress rate
			/*if(typeof(trns_0001) == "object" && typeof(trns_0001.loadingProgressBar) == "function"){
				trns_0001.JOB = _ocallback['Job'];
			}*/
			/*else if(typeof(trns_0002_001) == "object" && typeof(trns_0002_001.loadingProgressBar) == "function"){
				trns_0002_001.JOB = _ocallback['Job'];
			}*/
		},"SHAREDSESSION":function(msg){
			_super.log("SHAREDSESSION Handle:"+JSON.stringify( msg ) );
				
		}
	};
	
	this.callbackCnt=0;
	this.getJSONPdata = function(url, callback, _timeout){
		$.ajax({
			url : url + "?q=" + Math.random(),
			dataType : 'jsonp',
			timeout : _timeout,
			success : function(msg) {
				callback( msg );
			},
			error : function(xhr, textStatus, errorThrown) {
				callback({"ErrorCode":"99999999" ,"ErrorMsg":"통신오류 입니다."});
			}
		});
	};

	/* 소켓 메시지 전송 */
	this.sendMsg = function(msg) {
		if (msg == "SharedSession"){
			var t = {"Msg":"SharedSession"};
			msg = t;
		}
		
		var _this = this;
		if (_this.FEB.socket == null) return;
		if (_this.FEB.socket.readyState != WebSocket2.OPEN) {// 1
			if (_this.FEB.socket.readyState == 3) {
				_this.log("Status::" + _this.FEB.socket.readyState);
				return;
			}else if (_this.FEB.socket.readyState == 0) {
				console.log('소켓 연결이 완료되지 않았습니다. (개발계 전용 메시지)');
				return;
			}
		}
		try {
			if(_this.LOG_MODE){
				_this.log("SEND Message");
				_this.log( JSON.stringify( msg ) );
			}
			this.FEB.socket.send( JSON.stringify( msg ) );
		} catch (e) {
			this.log("Error Message::" + e + "\n" + msg);
		}
	};

	/**
	 * 소켓 연결상태 확인
	 */
	this.isWebSocket = (function() {
		if (this.FEB.socket == null){
			return false;
		}
		return this.FEB.socket.readyState == WebSocket2.OPEN ? true : false;
	});

	this.sendFlag = true;
	/* 전체취소 메시지 */
	this.cancelAll = function(Uid) {
		var _this = this;
		var cancelMsg ={"Msg":"CancelAll"};
		_this.sendMsg(cancelMsg);
		this.sendFlag = false;
	};

	/* 취소메시지 */
	this.cancel = function(_ThreadIndex) {
		var cancelMsg ={"Msg":"Cancel"};
		_this.sendMsg(cancelMsg);
	};
	
	/** 
	 * Open 메시지
	 * ThreadLength: 1~시작되어야함 
	 **/
	this.open = function(ThreadLength,callback) {
		var _this = this;
		this.sendFlag = true;
		if(! $.isNumeric( ThreadLength )){
			console.log("ThreadLength는 숫자를 입력하세요. (개발계 전용 메시지)");
			return;
		}
		_this.ThreadLength = ThreadLength;
		
		var openMsg = {"Msg":"Open", "ThreadLength":String(ThreadLength) ,"License":CooconLicense};
		if( _this.encMode  && ( _this.null2void(_this.OpenUid ) == "" ) || _this.null2void(_this.OpenAction ) == ""){
			_this.setUidAction(_this.randomString(40) , _this.randomString(40));
			openMsg["Uid"]=_this.null2void( _this.OpenUid);
			openMsg["Action"]=_this.null2void( _this.OpenAction);
		}else if( _this.encMode ){
			openMsg["Uid"]= _this.OpenUid;
			openMsg["Action"]= _this.OpenAction ;
		}
		
		if(_this.OpenCallback != null){
			console.log('진행중인 거래건이 있습니다. (개발계 전용 메시지)');
			return;
		}
		_this.OpenCallback = callback;
		_this.sendMsg( openMsg );
		
	};
		
	this.getVersion=function(callback){
		var URL= this.ServiceURL+"VERSION";
		this.log("URL::"+URL);
		this.getJSONPdata ( URL , callback , 10000);
	};
	
	this.Run=function(callback){
		var URL= this.ServiceURL+"RUN";
		this.getJSONPdata ( URL , callback , this.RunTimeout);
	};

	this.RunAdmin=function(callback){
		var URL= this.ServiceURL+"RUNADMIN";
		this.getJSONPdata ( URL , callback, this.RunTimeout);
	};
	this.Kill=function(callback){
		this.Reqmsg = [];/* 요청데이터 */
		this.ReqmsgCnt = [];/* 요청데이터 */
		this.ResultList=[];
		var URL= this.ServiceURL+"KILL";
		this.getJSONPdata ( URL , callback, 1000);
	};
	this.Update=function(callback){
		var URL= this.ServiceURL+"UPDATE";
		this.getJSONPdata ( URL , callback, this.UpdateTimeout);
	};

	//shutdown
	/* 모듈 초기화 (웹소켓 연결) */
	this.init = function(callback) {
		var _this = this;
		_this.getVersion(function (ver) {
			
			_this.log(ver);
			if(ver['Result']== null){
				callback( false );
				return;
			}
			var verInfo = ver['Result'].Version;
			
			if( !_this.VersionCheck(verInfo) ){
				if(verInfo != null ){
					//console.log('하위버전이 설치되어 모듈업데이트를 실행합니다.');	// #37011
					top.tmsComm.destroyProgressBar();
					_v2common.app.showMessage('WBI6022', {}, function(result) {
						if (result) {
							top.tmsComm.createProgressBar();
							_this.log("Kill Call");
							_this.Kill(function (){
								_this.log("Update Call");
								_this.Update(function (up) {
									if(up.ErrorCode != '00000000'){
										console.log(up.ErrorCode + "\n" +up.ErrorMessage);
										return false;
									}
									if(_this.RUNLEVEL == 0){
										//0:소켓 서버 사용자 권한으로 실행
										_this.log("Run Call");
										_this.Run(function (msg){
											_this.log("Callback Run:"+JSON.stringify(msg));
											if( msg.ErrorCode =="00000000" ){
												_this.connect( function(){ if( typeof callback == "function" ) callback(true); } );
											}
											return;
										});
									}else if(_this.RUNLEVEL == 1){
										//1:소켓서버 관리자 권한으로 실행
										_this.log("RunAdmin Call");
										_this.RunAdmin(function (msg){
											_this.log("Callback RunAdmin:"+JSON.stringify(msg));
											if( msg.ErrorCode =="00000000" ){
												_this.connect( function(){if( typeof callback == "function" ) callback(true); } );
											}
											return;
										});
									}
									top.tmsComm.destroyProgressBar();	
								});
								
							});
							
						}
					});
				}else{
					if( typeof callback == "function" ) callback(false);
					return;
				}
			}else{
				if(_this.RUNLEVEL == 0){
					//0:소켓 서버 사용자 권한으로 실행
					_this.log("Run Call");
					_this.Run(function (msg){
						_this.log("Callback Run:"+JSON.stringify(msg));
						if( msg.ErrorCode =="00000000" ){
							_this.connect( function(){ if( typeof callback == "function" ) callback(true); } );
						}
						return;
					});
				}else if(_this.RUNLEVEL == 1){
					//1:소켓서버 관리자 권한으로 실행
					_this.log("RunAdmin Call");
					_this.RunAdmin(function (msg){
						_this.log("Callback RunAdmin:"+JSON.stringify(msg));
						_this.connect( function(){ if( typeof callback == "function" ) callback(true); } );
						return;
					});
				}
			}
			
		});
	};
	
	this.VersionCheck = function(installVersion) {
		if (installVersion == null)
			return false;
		if (this.CurrentVersion == installVersion) {
			this.versionCheck = true;
			return true;
		}
		var insVersion = installVersion.split(".");
		var curVersion = this.CurrentVersion.split(".");
		for (var i = 0; i < curVersion.length; i++) {
			if (Number(insVersion[i]) == Number(curVersion[i])) {
				continue;
			} else if (Number(curVersion[i]) > Number(insVersion[i])) {
				return false;
			} else {
				this.versionCheck = true;
				return true;
			}
		}
		return false;
	};
	
	/* 로그 */
	this.log = function(o) {
		if (this.LOG_MODE) {
			if (window.console && window.console.log && window.console.error) {
				console.debug("iSAS 3.0["+new Date().toLocaleString()+"]:", o);
			}
		}
	};
	
	this.isValid = function (inputList){
		var _this = this;
		if (_this.FEB.socket.readyState != WebSocket2.OPEN) {
			console.log('연결에 실패하였습니다. 잠시 후 다시 이용바랍니다. (개발계 전용 메시지)');
			return false;
		}
		return true;
	};
		
	this.executeRun = function(ThreadIndex){
		var _this = this; 
		var param = _this.Reqmsg[ThreadIndex];
		if( _this.ReqmsgCnt[ThreadIndex] == null ){
			_this.ReqmsgCnt[ThreadIndex] = 0;
		}
		var input = {};
		input['Msg']="Run";
		input['ThreadIndex']=String(ThreadIndex);
		input['Param']= param[_this.ReqmsgCnt[ThreadIndex]];
		_this.sendMsg(input);
		
		//#37982
		//Need to call below function for updating the progress rate
		if(typeof(trns_0001) == "object" && typeof(trns_0001.loadingProgressBar) == "function"){
			trns_0001.JOB = input.Param.Job;
		}
		
		++_this.ReqmsgCnt[ThreadIndex];
	};
	
	/**
	 * 스크래핑 실행 및 콜백정의
	 */
	this.execute = function( inputList , ThreadIndex , callback ) {					
		var _this = this;
		//if (inputList[0]['Job'] == 'CAPTCHA'){
		//	var sharedSessionMsg = {"Msg" : "SharedSession"};
		//	_this.sendMsg(sharedSessionMsg);
		//}
		if(!_this.isValid(inputList))return;
		_this.ReqmsgCnt[ThreadIndex]=0;//진행건수 초기화
		if(ThreadIndex == null)ThreadIndex = 0;
		_this.Reqmsg[ThreadIndex] = inputList;
		_this.ResultList[ThreadIndex] = {"RequestCount":inputList , "ResultList":[] ,"ThreadIndex":ThreadIndex };
		_this.ResultCallback[ThreadIndex]=callback;
		_this.executeRun(ThreadIndex);
	};

	/* tag 생성 */
	this.makeDivTag = function(_id) {
		var $div = $("#" + this.id);
		if ($div.length < 1) {
			$div = $("<div/>").attr({id : _id});
			$(document.body).append($div);
		}
	};
	
	this.getCertList = function(callback){
		var _this = this;
		var input ={};
		input['Msg'] = "CERTLIST";
		_this.CertListCallback = callback;
		_this.sendMsg(input);
	};
	this.PMSelector = "";//프로세스 메니저 셀렉터
	// 0 ~ (입력한 쓰레드 수-1) 만큼 오름차순으로 정렬된 Array 생성하는 함수
	// executeRun과 동일한 작업을 수행하나, input 구조를 읽어오는게 다릅니다.
	this.dynamicExecuteRun = function(ThreadIndex) {
		var _this = this;
		var param = _this.Reqmsg[ThreadIndex];
		if (_this.ReqmsgCnt[ThreadIndex] == null) {
			_this.ReqmsgCnt[ThreadIndex] = 0;
		}
		var input = {};
		input['Msg'] = 'Run';
		input['ThreadIndex'] = String(ThreadIndex);
		input['Param'] = param[0];
		_this.sendMsg(input);
		++_this.ReqmsgCnt[ThreadIndex];
		++_this.ReqmsgCntNumber;
	};

	this.setThreadCheckArray = function(ThreadLength) {
		var _this = this;

		_this.resultArray = [];
		_this.threadWorkCheckingArray = [];
		for (var i = 0; i < ThreadLength; i++) {
			_this.threadWorkCheckingArray.push(i);
		}
		// _this.threadWorkCheckingArray = new Array(parseInt(ThreadLength)).fill(0);
	};

	this.getResultArray = function() {
		var _this = this;

		return _this.resultArray;
	};

	this.dynamicExecute = function(inputList, callback) {
		var _this = this;
		_super.totalInput = inputList.length;
		_super.resultArray = [];
		if(_this.threadWorkCheckingArray.length == 0) this.setThreadCheckArray(1);
		function timeout() {
			setTimeout(() => {
				var ThreadIndex = _this.threadWorkCheckingArray.shift();
				if (!inputList.length) {
					console.log('end');
					return;
				}
				if (ThreadIndex == undefined) {
					timeout();
				} else {
					_this.Reqmsg[ThreadIndex] = [inputList.shift()];
					_this.ResultList[ThreadIndex] = { RequestCount: inputList, ResultList: [], ThreadIndex: ThreadIndex };
					_this.ResultCallback[ThreadIndex] = callback;
					_this.dynamicExecuteRun(ThreadIndex);
					timeout();
				}
			}, 1250);
		}
		timeout();
	};
}

/* 프로세스 관리자 화면 팝업 디자인 */
(function($) {
	$.fn.makeProcessManager = function(ThreadLength) {
		
		var nx = CooconiSASNX;
		var s = this.selector;
		var $div = $(s);
		//쓰레드 갯수 지정
		if(ThreadLength == null || ThreadLength == 0 ){
			ThreadLength = 1;
		}
		
		nx.ProcDisplay = true;
		if( $(s).is(':visible') ){
			console.log('스크래핑 실행중인 건이 있습니다. (개발계 전용 메시지)');
			return false;
		}
		nx.PMSelector=s;
		nx.ThreadLength=ThreadLength;
		var ss = s.substring(1, this.selector.length);
		
		if ($div.length < 1) {
			$div = $("<div/>").attr({ id : ss });
			$(document.body).append($div);
		}
		
		var html = '';
		html += '<div class="pop_wrap" id="layer_process_status" style="width: 650px;">';
		html += '<div class="pop_header">';
		html += '<h1>프로세스 관리자</h1>';
		html += '<div>';
		html += '<a href="#" class="btn_popclose"  ><img src="./img/btn/btn_popclose.png" alt="Close" /></a>';
		html += '</div>';
		html += '</div>';
		html += '<div class="pop_container">';
		html += '<div class="caution_box">';
		/**
		 * proc_module_cnt_{i} : 
		 * proc_job_cnt_{i}:전체 건수
		 * progressbar_{i} : 진행바
		 * okcancel_btn_{i} : Cancel/Ok  버튼
		 */
		for(var i=0 ;i < ThreadLength ; i++){
			html += '<div>';
			html += '<span class="desc" style="display: block; text-align: left;">';
			html += '<span>데이터 처리 </span>';
			html += '( <span class="txt_b" id="proc_module_cnt_'+i+'"></span> - <span class="txt_b1" id="proc_job_cnt_'+i+'"></span> )';
			html += '</span>';
			html += '<div class="progress_wrap mgt10 mgb10">';
			html += '<div class="progress_bar">';
			html += '<progress id="progressbar_'+i+'" class="progress_amount" style="width:100%;" max="100" value="0">%</progress>';
			html += '</div>';
			if(i == (ThreadLength -1)){
				html += '<div>';
				html += '<a href="#none" class="btn_style1_w"><span id="okcancel_btn">취소</span></a>';
				html += '</div>';
			}
			html += '</div>';
		}

		html += '</div>';
		html += '<div id="errMsgLayer" style="display:none;" class="mgt25 mgb10">';
		html += '<span class="desc txt_r" style="display: block; text-align: left;">아래 오류 내용을 확인하시기 바랍니다.</span>';
		html += '<div id="errMsgBox" class="cnt_msm mgt5" style="height: 181px; overflow: hidden; overflow-y: auto;">';
		html += '</div>';
		html += '</div>';
		html += '</div>';
		html += '</div>';
		
		$(s).empty().append(html);
		$(s).show();
		/**
		 * OK or cancel 버튼
		 */
		$(s + " #okcancel_btn").click(function() {
			if( $(this).text() == "취소" ){
				nx.cancelAll();
			}
			else if( $(this).text() == "확인" ){
				for(var i=0; i<nx.ThreadLength; i++){
					if( nx.ResultCallback[i] != null && typeof  nx.ResultCallback[i] == "function"){
						nx.ResultCallback[i]( nx.ResultList[i].ResultList , i);
					}
				}
				$(s).remove();
			}
		});
		$(s + " .btn_popclose").click(function() {
			nx.cancelAll();
			$(s).hide();
		});
		return true;
	};

	/* 인증서 팝업 디자인 */
	$.fn.makeCertManager = function(callback) {
		var html = '';
		var s = this.selector;
		var nx = CooconiSASNX;
		var $div = $(s);

		if ($div.length < 1) {
			var ss = s.substring(1, this.selector.length);
			$div = $("<div/>").attr({ id : ss });
			$(document.body).append($div);
			html += '<div id="cert_pop">';
			html += '<div class="cert_top"><h1>인증서 선택</h1><a class="close" title="닫기"></a></div>';
			html += '<div class="cert_mid">';
			html += '<div>';
			html += '<h2 class="bul1">인증서를 선택해 주세요.</h2>';
			html += '<div class="ctable tb_thead">';
			html += '<table>';
			html += '<colgroup><col style="width:15%;"><col style="width:10%;"><col><col style="width:15%;"><col style="width:15%;"></colgroup>';
			html += '<tr><th>구분</th><th>Disk</th><th>사용자</th><th>만료기간</th><th>발급자</th></tr>';
			html += '</table>';
			html += '</div>';
			html += '<div class="ctable tb_scroll">';
			html += '<table>';
			html += '<colgroup><col style="width:15%;"><col style="width:10%;"><col><col style="width:15%;"><col style="width:15%;"></colgroup>';
			html += '</table>';
			html += '</div>';
			html += '</div>';
			html += '<div>';
			html += '<h2 class="bul1">인증서 암호를 입력해 주세요.</h2>';
			html += '<div class="cipt"><input type="password" placeholder="인증서 암호는 대소문자를 구분합니다."></div>';
			html += '</div>';
			html += '<div class="cbtn_wrap"><a class="cbtn type1">확인</a> <a class="cbtn type2">취소</a></div>';
			html += '</div>';
			$(s).empty().append(html);

			/* 취소 */
			$(s + " .close ," + s + " .cbtn.type2").click(function() {
				$(s + ' input').val('');
				$(s + ' .tb_scroll tr').remove();
				$(s).hide();
			});

			/* 확인 */
			$(s + " a.cbtn.type1").click(function() {

				var pwd = $(s + ' input').val();
				if (pwd == '') {
					console.log('인증서 비밀번호를 입력하세요. (개발계 전용 메시지)');
					$(s + ' input').focus();
					return;
				}
				var data = $(s + ' .tb_scroll tr.on').attr("data");
				if (data == null || data == "") {
					console.log('인증서를 선택하세요. (개발계 전용 메시지)');
					return;
				}
				if (callback != null && typeof callback == "function") {
					data = JSON.parse(data);
					data['CertPwd'] = pwd;
					$(s).hide();
					$(s + ' .tb_scroll tr').remove();
					callback(data);
				}
			});

			/* pwd enter */
			$(s + " input[type=password]").keypress(function(e) {
				if (e.keyCode == 13) {
					var pwd = $(s + ' input').val();
					if (pwd == '') {
						console.log('인증서 비밀번호를 입력하세요. (개발계 전용 메시지)');
						$(s + ' input').focus();
						return;
					}
					var data = $(s + ' .tb_scroll tr.on').attr("data");
					if (data == null || data == "") {
						console.log('인증서를 선택하세요. (개발계 전용 메시지)');
						return;
					}
					if (callback != null && typeof callback == "function") {
						data = JSON.parse(data);
						data['CertPwd'] = pwd;
						$(s).hide();
						$(s + ' .tb_scroll tr').remove();
						callback(data);
					}
				}
			});
		}
		$(s + ' input').val('');
		$(s).show();

		/* 인증서 목록 조회 */
		nx.getCertList(function(results) {
			$(s + " .tb_scroll > table tr").remove();
			for (var i = 0; i < results.length; i++) {
				var html = '';
				var cinfo = results[i];
				html += '<tr class="" data=\'' + JSON.stringify(cinfo) + '\'>';
				html += '<td><img src="./img/img_cert.gif" title="' + cinfo['Type'] + '"><div class="ellipsis">' + cinfo['Type'] + '</div></td>';
				html += '<td><div class="tac" title="'+ cinfo['Drive'] +'">' + cinfo['Drive'] + '</div></td>';
				html += '<td><div class="ellipsis" name ="cinfo" ></div></td>';
				html += '<td class="t_center" title="' + cinfo['ExpiryDate'] + '" >' + cinfo['ExpiryDate'] + '</td>';
				html += '<td><div class="ellipsis" title="' + cinfo['Issuer'] + '">' + cinfo['Issuer'] + '</div></td>';
				html += '</tr>';
				$(s + " .tb_scroll > table").append(html);
				$(s + " .tb_scroll > table [name=cinfo]").eq(i).attr("title", cinfo['User']);
				$(s + " .tb_scroll > table [name=cinfo]").eq(i).text(cinfo['User']);
			}
			/* 선택 이벤트 */
			$(s + " .tb_scroll > table tr").click(function() {
				$(s + " .tb_scroll tr").removeClass("on");
				$(this).addClass("on");
			});
		});
	};

})(jQuery);

/* 페이지 이동시 세션 클로즈 */
$(window).on("beforeunload", function() {
	var nx = CooconiSASNX;
	if (nx.isWebSocket()) {
		nx.cancelAll();// 모든거래 취소
	}
//	nx.Kill();//강제종료
});
