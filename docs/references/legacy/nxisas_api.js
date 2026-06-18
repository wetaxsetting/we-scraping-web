/* =====================================================================
 * LEGACY BEHAVIOR REFERENCE — NOT LOADED AT RUNTIME, NOT THE ARCHITECTURE.
 * ---------------------------------------------------------------------
 * Verbatim copy of the live JEX bundle
 *   WECMS DEV/WECMS_STATIC/web/nxisas/js/nxisas_api.js
 * kept ONLY as a behavioral spec for porting bank-specific scraping
 * rules into the Spring layer (NxisasBankConfig / BankScrapingService /
 * BankTransactionSyncService / NxisasGatewayClient).
 *
 * THIS FILE IS NOT SHIPPED AND NOT EXECUTED:
 *   - It lives OUTSIDE wecms-web/public/ so Next.js never serves it.
 *   - It is NOT in use-nxisas-engine.ts SCRIPT_LOAD_ORDER.
 *   - It must NEVER be loaded — loading it would shadow the active
 *     window._v2nxisas defined by nxisas_v2.js (both forks do a bare
 *     `_v2nxisas = {...}` assignment; last load wins) and break the
 *     EXE/local-engine flow.
 *
 * Runtime architecture (unchanged):
 *   - EXE/local-engine pages (Own Account Transfer, e-Invoice update,
 *     GDT): use-nxisas-engine.ts -> nxisas_v2.js / isasscaping.js -> NXiSAS.exe
 *   - API scraping pages (Account Inquiry VND/FCY, Bank Transaction Sync,
 *     Bank Login Credentials): Spring REST -> BankScrapingService /
 *     BankTransactionSyncService -> NxisasGatewayClient -> Coocon
 *
 * Use as read-only reference when extracting: OSMC Module/Class lookup,
 * per-bank login-type rules, per-bank password/form rules, transfer-
 * confirmation field visibility, OTP/CAPTCHA/QNA continuation edge cases,
 * and error-code mapping. Original (canonical) source of truth remains the
 * JEX tree; this copy carries no edits below this banner.
 * ===================================================================== */
/**
 * Usage : "".startsWith("st") <br />
 * 문자열이 "st"로 시작할 경우 true, 그렇지 않을 경우 false를 리턴한다.
 *
 * @method startsWith
 * @param {String} str
 * @return {Boolean} {str}로 시작할 경우 true, 그렇지 않을 경우 false
 */
if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function(str) {
        return new RegExp("^" + str).test(this);
    };
}

/**
 * Usage : "".endsWith("st") <br />
 * 문자열이 "st"로 끝나는 경우 경우 true, 그렇지 않을 경우 false를 리턴한다.
 *
 * @method endsWith
 * @param {String} str
 * @return {Boolean} {str}로 끝나는 경우 true, 그렇지 않을 경우 false
 */
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function(str) {
        return new RegExp(str + "$").test(this);
    };
}

_nxisas_auth = {}

$(function(){
	
	// 2차인증의 응답값 텍스트 입력 후 엔터 클릭 시 이벤트
	$(document).off('keypress', ".layerCont.captcha input[name='res'], .layerCont.otp input[name='res'], .layerCont.security-question input[name='res']");
	$(document).on('keypress', ".layerCont.captcha input[name='res'], .layerCont.otp input[name='res'], .layerCont.security-question input[name='res']", function(e) {
		if (e.keyCode === 13) {
			e.preventDefault();	
			
			$(e.target).closest(".layerCont").find(".save:eq(0)").trigger('click');
		}
	});
	
    // Only AlphaNumeric - CAPTCHA
	$(document).off("input", ".layerCont.captcha input[name='res']");
	$(document).on("input", ".layerCont.captcha input[name='res']", function () {
	    var val = $(this).val();
	    var Rtext = new RegExp("^([a-zA-Z0-9]+)$");
	    var t = Rtext.test(val);
	    if (!t) {
	        $(this).val(val.replace(/[^a-zA-Z0-9]/g,''));
	    }
	});
	
	// Only Numeric - OTP
	$(document).off("input", ".layerCont.otp input[name='res']");
	$(document).on("input", ".layerCont.otp input[name='res']", function () {
		var val = $(this).val();
		var Rtext = new RegExp("^([0-9]+)$");
		var t = Rtext.test(val);
		if (!t) {
			$(this).val(val.replace(/[^0-9]/g, ''));
		}
	});
	
	// 비밀번호 입력 페이지 엔터 클릭 이벤트
	$(document).off('keypress', ".layerCont.account-management .item-table input:last");
	$(document).on('keypress', ".layerCont.account-management .item-table input:last", function(event){
		if (event.keyCode === 13) {
			$(".layerCont.account-management #btn-wrap-default .save").trigger('click');		
		}
	});
	
	// 2차인증 팝업의 Cancel 버튼 및 X 버튼 클릭시 이벤트
	$('body').off('click', ".layerCont.otp .cancel, .layerCont.captcha .cancel, .layerCont.security-question .cancel, .layerCont.otp .layerPopup-close, .layerCont.captcha .layerPopup-close, .layerCont.security-question .layerPopup-close, .layerCont.account-management .close_putpassword, .layerCont.account-management .cancel_putpassword, .layerCont.transfer_confirmation .btn-area a.cancel, .layerCont.transfer_confirmation .layerPopup-close");
	$('body').on('click', ".layerCont.otp .cancel, .layerCont.captcha .cancel, .layerCont.security-question .cancel, .layerCont.otp .layerPopup-close, .layerCont.captcha .layerPopup-close, .layerCont.security-question .layerPopup-close, .layerCont.account-management .close_putpassword, .layerCont.account-management .cancel_putpassword, .layerCont.transfer_confirmation .btn-area a.cancel, .layerCont.transfer_confirmation .layerPopup-close", function(e) {
		e.preventDefault();
		var _threadIndex = $(this).closest(".layerCont").attr("for");
		var _2ndCertIndex = $(this).closest(".layerCont").attr("for2");
		var _bankCd = _v2nxisas.orgObj[_threadIndex].bankCd;
		var _seqno = (!jexjs.empty(_v2nxisas.orgObj[_threadIndex].nxisasGbSeqNo) ? _v2nxisas.orgObj[_threadIndex].nxisasGbSeqNo : '0');
		var _bankNm = _v2nxisas.orgObj[_threadIndex].bankNm;
		var _bankCd = _v2nxisas.orgObj[_threadIndex].bankCd;
		var _job = _v2nxisas.orgObj[_threadIndex].job;
		var _msgCode = 'WBC1152'; 
		
		if("VIETNAM_GDT" == _bankCd) _bankNm = "GDT";
		
		//https://flow.team/l/PP5sU
		if(typeof(_job) == "object" && (_job[0].Job == "TRANSFER_INTERNAL" || _job[0].Job == "TRANSFER_INTERNAL_ML" || _job[0].Job == "TRANSFER" 
			|| _job[0].Job == "TRANSFER_ML" || _job[0].Job == "RECIEVER_INFO")){
			_msgCode = 'WBC1140'; //Transfer -> Would you like to cancel the transfer to #Bank Name?
		}
		
		var _isPutPassword = ($(this).closest(".layerCont.account-management").length == 1);
		
//		if ($(this).closest('.layerCont.account-management').length == 0) {		// 패스워드 입력일 때는 실행하지 않음.
//			_v2nxisas._2ndCertIndex++;	
//		}
		_v2common.app.showMessage(_msgCode, {'dataObj' : {'BANK_NM' : _bankNm}}, function(result) {
			if (result) {
				if (_v2nxisas.progress) {
					top.tmsComm.createProgressBar();	
				}
				
				_v2common.app.closeLayerPopup(function() {
					//_v2nxisas._2ndCertCompletedIndex++;
					var _res = [];
					var _header = _v2nxisas.makeHeader(_bankCd, _seqno, 'LOGIN');
					var _output = {};
					_output.ErrorCode = "LOGIN_CAN";
					_output.ErrorMessage = jexML.get("nxisas_v2_j034", "진행중인 작업을 취소하였습니다.");
					_header.Output = _output;
					
					var _input = {};
					_input.bankCd = _v2nxisas.orgObj[_threadIndex].bankCd;
					_input.loginID = _v2nxisas.orgObj[_threadIndex].loginID;
					_header.Input = _input;
					_res.push(_header);
					//_v2nxisas._loginFinishCount++;
					if (_isPutPassword) {
						_v2nxisas.run_afterLoginFail(_res, _threadIndex);
						_v2nxisas._putPasswordCallback(null);	
					} else {
						_v2nxisas.run_afterLoginFail(_res, _threadIndex, _2ndCertIndex);
					}
				});				
			}
		});
	});
	
	// 2차인증 팝업의 Save(Confirm) 버튼  클릭시 이벤트
	$('body').off('click', ".layerCont.captcha .save, .layerCont.otp .save, .layerCont.security-question .save, .layerCont.transfer_confirmation .btn-area a.confirm");
	$('body').on('click', ".layerCont.captcha .save, .layerCont.otp .save, .layerCont.security-question .save, .layerCont.transfer_confirmation .btn-area a.confirm", function(e) {
		var _popupObj = $(this).closest(".layerCont");
		var _2ndCertType = '';
		var _isTrnsConf = false;
		if (_popupObj.hasClass('captcha')) {
			_2ndCertType = 'CAPTCHA';
		} else if (_popupObj.hasClass('otp')) {
			_2ndCertType = 'OTP';
		} else if (_popupObj.hasClass('security-question')) {
			_2ndCertType = 'QNA';			
		}else if (_popupObj.hasClass('transfer_confirmation')) {
			var typePopup = _popupObj.data("type");
			//console.log("typePopup >> ", typePopup);
			_2ndCertType = typePopup;
			_isTrnsConf = true;	
			//console.log("trns_0001 >> ",trns_0001);
			if(typeof(trns_0001) != "undefined"){
				trns_0001.openProgressBar();
	        	trns_0001.PROGRESS = 0;
			}
		}
		
		/*Start Validation input*/
		if ('QNA' == _2ndCertType) {
			var _req = $(this).closest(".layerCont").find("input[name='req']").val();
			if ('' == _req) {
	            _v2common.app.showMessage("WBE6120");			
				return false;
			}			
		}
		
		if(_isTrnsConf){//Transfer
			if($(this).closest(".layerCont").find("#OTP_PWD").is(":visible")){
				//TODO: OPT PASSWORD
				var otpRes = $(this).closest(".layerCont").find("#OTP_PWD input[name='otp_pwd']").val();
				if ('' == otpRes) {
		            var dObj = {
		                dataObj: { "FIELD_NM": "OTP Password" }
		            };
		            _v2common.app.showMessage("WBE6021", dObj);
		            $(this).closest(".layerCont").find("#OTP_PWD input[name='otp_pwd']").focus();			
					return false;
				}
			}
			//move to main page
			/*else if($(this).closest(".layerCont").find("#TRNS_PWD").is(":visible")){
				//TODO: TRANSFER PASSWORD
				var trnsRes = $(this).closest(".layerCont").find("#TRNS_PWD input[name='trns_pwd']").val();
				if ('' == trnsRes) {
		            var dObj = {
		                dataObj: { "FIELD_NM": "Transfer Password" }
		            };
		            _v2common.app.showMessage("WBE6021", dObj);		
		            $(this).closest(".layerCont").find("#TRNS_PWD input[name='trns_pwd']").focus();	
					return false;
				}
			}*/
		} else {//Another of Transfer
			var _res = $(this).closest(".layerCont").find("input[name='res']").val();
			if ('' == _res) {
	            var dObj = {
	                dataObj: { "FIELD_NM": _2ndCertType }
	            };
	            _v2common.app.showMessage("WBE6021", dObj);			
				return false;
			}
		}
		/* End Validation input*/
		
		//if (_v2nxisas.progress) {
			top.tmsComm.createProgressBar();	
		//}
		var _threadIndex = $(this).closest(".layerCont").attr("for");
		var _2ndCertIndex = parseInt($(this).closest(".layerCont").attr("for2"));
		var _bankCd = _v2nxisas.orgObj[_threadIndex].bankCd;
		var _seqno = (!jexjs.empty(_v2nxisas.orgObj[_threadIndex].nxisasGbSeqNo) ? _v2nxisas.orgObj[_threadIndex].nxisasGbSeqNo : '0');
		
		var _header = _v2nxisas.makeHeader(_bankCd, _seqno, _2ndCertType);
		
		/*console.log("_threadIndex>> ", _threadIndex)
		console.log("_2ndCertIndex>> ", _2ndCertIndex)
		console.log("_bankCd>> ", _bankCd)
		console.log("_seqno>> ", _seqno)
		console.log("_header>> ", _header)*/
		
		if ('QNA' == _2ndCertType) {
			var _qnaRes = {};
			_qnaRes.Question = $(".layerCont.security-question #selectList0 li.selected").attr('data-val');
			_qnaRes.HiddenValue = $(".layerCont.security-question #selectList0 li.selected").attr('data-hiddenval');
			_qnaRes.Answer = $(this).closest(".layerCont").find("input[name='res']").val();
			var _input = {"res" : _qnaRes};
			_header.Input = _input;
		} else if(_isTrnsConf){ // Transfer Confirmation
			var _input = {};
			if($(this).closest(".layerCont").find("#OTP_PWD").is(":visible")){ //OTP Password enable
				_input = {"res" : $(this).closest(".layerCont").find("#OTP_PWD input[name='otp_pwd']").val()};
			}else{ // Without OTP and Transaction Password
				_input = {"res" : "Y"};
			}
			//move to main page
			/*else if($(this).closest(".layerCont").find("#OTP_PWD").is(":visible")){ //Transaction Password enable
				_input = {"res" : $(this).closest(".layerCont").find("#TRNS_PWD input[name='trns_pwd']").val()};
			}*/
			//console.log("_input >> ",_input);
			_header.Input = _input;
		}else {
			var _input = {"res" : $(this).closest(".layerCont").find("input[name='res']").val()};
			_header.Input = _input;
		}
		
		_v2nxisas.nxisasObj[_threadIndex] = [];
		_v2nxisas.nxisasObj[_threadIndex].push(_header);

		console.log("Auth:", _nxisas_auth);
		
		// 2차인증시도함.
		_v2nxisas.execute(
			_v2nxisas.nxisasObj[_threadIndex],
			_threadIndex,
			function(res, seq) {
				if ('undefined' != typeof(res[0].Output.Result.CallBackfunc)) {		// 정상 응답을 하되 CallBackFunc을 다시 내려줄 때가 있음. (오입력이거나 추가인증이 더 필요한 경우.)
					if ('VIETNAM_GDT' == _v2nxisas.orgObj[seq].bankCd) {
						top.tmsComm.destroyProgressBar();
						if (_v2nxisas._GDTCaptchaTryCount >= 3) {
							_v2common.app.closeLayerPopup(function() {
								_v2nxisas.run_afterLoginFail(res, seq);
							});
						} else {
							_v2common.app.showMessage("WBE6121", function() {
								_v2common.app.closeLayerPopup(function() {
									_v2nxisas.makeLoginInput(seq, true, function() {
										_v2nxisas.execute(_v2nxisas.nxisasObj[seq], seq, function(res2, seq2) {
											_v2nxisas.run_afterLoginSuccess(res2, seq2, _2ndCertIndex);	// 2차 인증 재시도를 위해 2차인증 Queue의 Index를 같이 들고 가서 해당 Index의 값을 바꿔치기 해야함. (바꿔치기 안하면 다른 Queue들에 밀리므로.)
										}, function(res2, seq2) {
											_v2nxisas.run_afterLoginFail(res2, seq2);
										});
									});
								});
							});
						}
					} else {

						_v2common.app.closeLayerPopup(function() {
							_v2nxisas.run2ndCert(_threadIndex, res[0].Output.Result, _2ndCertIndex);	// 2차 인증 재시도.
							/**
							_v2nxisas.makeLoginInput(seq, true, function() {
								_v2nxisas.execute(_v2nxisas.nxisasObj[seq], seq, function(res2, seq2) {
									_v2nxisas.run_afterLoginSuccess(res2, seq2, _2ndCertIndex);	// 2차 인증 재시도를 위해 2차인증 Queue의 Index를 같이 들고 가서 해당 Index의 값을 바꿔치기 해야함. (바꿔치기 안하면 다른 Queue들에 밀리므로.)
								}, function(res2, seq2) {
									_v2nxisas.run_afterLoginFail(res2, seq2);
								});
							});
							*/
						});
					}
				} else {

					_v2common.app.closeLayerPopup(function() {
						//_v2nxisas._2ndCertIndex = null;
						if (_v2nxisas._2ndCertProcessingNonLogin) {
							_v2nxisas._2ndCertFinishCount++;
						} else {
							_v2nxisas._loginFinishCount++;
						}

						//console.log("trns_0001 >> ",trns_0001);
						if(_isTrnsConf && typeof(trns_0001) != "undefined"){
							trns_0001.closeProgressBar();
						}

						_v2nxisas.open2ndCertPop(++_2ndCertIndex);		// 그 다음 2차 인증 시도
						top.tmsComm.destroyProgressBar();

						//_v2nxisas.run_afterLoginSuccess(res, seq);		// 성공 응답 시에는 다음 프로세스로 진행.
						_v2nxisas.run_afterLoginSuccess(res, seq,_2ndCertIndex); // #38021: add _2ndCertIndex as third param because Transfer by IBK and Shinhan is not open second confirmation popup
					});
				}
			},
			function(res, seq) {
				top.tmsComm.destroyProgressBar();
				if(typeof(trns_0001) != "undefined"){
					trns_0001.closeProgressBar();
				}
				if ('80010171' == res[0].Output.ErrorCode || ('undefined' != typeof(res[0].Output.Result) && 'undefined' != typeof(res[0].Output.Result.CallBackfunc))) {		// 2차 인증 오입력 시에는 로그인부터 재시도.
					_v2common.app.closeLayerPopup(function() {
						_v2nxisas.makeLoginInput(seq, true, function() {
							_v2nxisas.execute(_v2nxisas.nxisasObj[seq], seq, function(res2, seq2) {
								_v2nxisas.run_afterLoginSuccess(res2, seq2, _2ndCertIndex);	// 2차 인증 재시도를 위해 2차인증 Queue의 Index를 같이 들고 가서 해당 Index의 값을 바꿔치기 해야함. (바꿔치기 안하면 다른 Queue들에 밀리므로.)
							}, function(res2, seq2) {
								_v2nxisas.run_afterLoginFail(res2, seq2);
							});
						});
					});
				} else {
					var _input = {};
					_input.bankCd = _v2nxisas.orgObj[_threadIndex].bankCd;
					_input.loginID = _v2nxisas.orgObj[_threadIndex].loginID;
					res[0].Input = _input;
					//_v2nxisas._2ndCertIndex++;
					_v2common.app.closeLayerPopup(function() {
						_v2nxisas.run_afterLoginFail(res, seq, _2ndCertIndex);
					});
				}
			},
			_nxisas_auth[_v2nxisas.orgObj[_threadIndex].bankCd].Common || {},
			_nxisas_auth[_v2nxisas.orgObj[_threadIndex].bankCd].SAS_SessionID || ""
		);
	});
	
	// 비밀번호 입력 창의 Save(Confirm) 버튼 클릭 이벤트
	$('body').off('click', ".layerCont.account-management .save_putpassword");
	$('body').on('click', ".layerCont.account-management .save_putpassword", function(e) {
		if (_v2common.app.validated(".layerCont.account-management input[data-require='true']")) {
			if ($(".layerCont.account-management #CERT_INFO_DETL_CON").val() != $(".layerCont.account-management #CERT_INFO_DETL_CON_2").val()) {
				_v2common.app.showMessage('WBE6100');
				return false;
			}
			
			var _password = $(".layerCont.account-management #CERT_INFO_DETL_CON").val();
			
			if ($(".layerCont.account-management #REG_CERT_INFO_DETL_CON_YN").prop("checked")) {	// Save this password에 체크되어 있으면 스크래핑 실행 후 로그인이 정상적으로 되면 저장.
				var _index = $(".layerCont.account-management").attr('for');
				var _dataObj = _v2nxisas.orgObj[_index];
				var _input = {};
				_input.BANK_CD = _dataObj.bankCd;
				_input.SEQ_NO = _dataObj.bankCertSeq;
				_input.CERT_INFO_DV = '1';
				_input.CERT_INFO_CON = $(".layerCont.account-management #CERT_INFO_CON").val();
				if ('00000000000000000072' == _dataObj.bankCd || '00000000000000000004' == _dataObj.bankCd
				 || '00000000000000000044' == _dataObj.bankCd || '00000000000000000043' == _dataObj.bankCd
				 || '00000000000000000064' == _dataObj.bankCd || '00000000000000000026' == _dataObj.bankCd
				 || '11704007' == _dataObj.bankCd) {
					_input.CERT_INFO_DETL_CON2 = $(".layerCont.account-management #CERT_INFO_DETL_CON2").val();
				}
				_input.CERT_INFO_DETL_CON = _password;
				
				_v2nxisas.updateCertInfo(_input, true);		
				
				//console.log("BANK_CD", _dataObj.bankCd)		
			}
			
			_v2common.app.closeLayerPopup(function() {
				_v2nxisas._putPasswordCallback(_password);					
			});				
		}
	});
	
	// 설치 안내 팝업의 Download 버튼 링크
	$('body').on('click', ".layerCont.alert .nxisas_download", function(e) {
		location.href = "./nxisas/file/NXiSAS.exe";
	});

});

_NXISAS_DATA_OBJ = 'NXISAS_DATA_OBJ';

_otp_template = ''
+ '<div class="layerCont otp" for="#{THREAD_INDEX}" for2="#{2NDCERT_INDEX}">                                                    '
+ '	<h1>OTP</h1>                                                                                                                '
+ '	<div class="layerPopupWrap">                                                                                                '
+ '		<form method="post" action="">                                                                                          '
+ '		<div id="layerPopup-contsBox" style="height:168px">                                                                     '
+ '			<div class="top">                                                                                                   '
+ '				<p>#{BANK_INFO}#{ADDITIONAL_INFO}</p>                                                                           '
+ '			</div>                                                                                                              '
+ '			<div class="OTP-img">                                                                                               '
+ '				<figure><img src="../../assets_v2/images/common/OTP.jpg" alt="" /></figure>                                     '
+ '			</div>                                                                                                              '
+ '			<ul class="item-table">                                                                                             '
+ '				<li>                                                                                                            '
+ '					<div class="required">OTP</div>                                                                             '
+ '					<div class="input-clear-box">                                                                               '
+ '						<label for="text[1]"></label>                                                                           '
+ '						<input type="text" size="" id="text[1]" name="res" value="" class="wd-100p" style="width: 98% !important;"placeholder="Enter OTP" />  '
+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                      '
+ '					</div>                                                                                                      '
+ '				</li>                                                                                                           '
+ '			</ul>                                                                                                               '
+ '		</div>                                                                                                                  '
+ '		<div id="btn-wrap-default" class="tar">                                                                                 '
+ '			<div class="btn-area">                                                                                              '
+ '				<a href="javascript:void(0);" class="btn-st common cancel">#{CANCEL}</a>                                           '
+ '				<a href="javascript:void(0);" class="btn-st primary save">#{CONFIRM}</a>                                              '
+ '			</div>                                                                                                              '
+ '		</div>                                                                                                                  '
+ '		</form>                                                                                                                 '
+ '	</div>                                                                                                                      '
+ '</div>                                                                                                                          ';

_captcha_template = ''
+ '<div class="layerCont captcha" for="#{THREAD_INDEX}" for2="#{2NDCERT_INDEX}">                                                    '
+ '	<h1>CAPTCHA</h1>                                                                                                                '
+ '	<div class="layerPopupWrap">                                                                                                    '
+ '		<form method="post" action="">                                                                                              '
+ '		<div id="layerPopup-contsBox">                                                                                              '
+ '			<div class="top">                                                                                                       '
+ '				<p>#{BANK_INFO}</p>                                                                                                 '
+ '			</div>                                                                                                                  '
+ '			<div class="captcha-code">                                                                                              '
+ '				<figure><img id="CAPTCHA_IMG" src="data:image/#{IMG_FORMAT};base64,#{IMG}" alt="CAPTCHA Image Generating..."></figure>        '
+ '			</div>                                                                                                                  '
+ '			<ul class="item-table">                                                                                                 '
+ '				<li>                                                                                                                '
+ '					<div class="required">CAPTCHA</div>                                                                             '
+ '					<div class="input-clear-box">                                                                                   '
+ '						<label for="text[1]"></label>                                                                               '
+ '						<input type="text" size="" id="text[1]" name="res" value="" class="wd-100p" placeholder="#{CAPTCHA_INPUT}" />  '
+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                          '
+ '					</div>                                                                                                          '
+ '				</li>                                                                                                               '
+ '			</ul>                                                                                                                   '
+ '		</div>                                                                                                                      '
+ '		<div id="btn-wrap-default" class="tar">                                                                                     '
+ '			<div class="btn-area">                                                                                                  '
+ '				<a href="javascript:void(0);" class="btn-st common cancel">#{CANCEL}</a>                                           '
+ '				<a href="javascript:void(0);" class="btn-st primary save">#{CONFIRM}</a>                                              '
+ '			</div>                                                                                                                  '
+ '		</div>                                                                                                                      '
+ '		</form>                                                                                                                     '
+ '	</div>                                                                                                                          '
+ '</div>                                                                                                                           ';

_qna_template = ''
+ '<div class="layerCont security-question" for="#{THREAD_INDEX}" for2="#{2NDCERT_INDEX}">                                                      '
+ '	<h1>#{Security_Question}</h1>                                                                                                                  '
+ '	<div class="layerPopupWrap">                                                                                                                '
+ '		<form method="post" action="">                                                                                                          '
+ '		<div id="layerPopup-contsBox">                                                                                                          '
+ '			<div style="display:flex; justify-content: space-between;">                                                                                                          						'
+ '				<div class="top">                                                                                                                   '
+ '					<p>#{BANK_INFO}</p>                                                                                                             '
+ '				</div>                                                                                                                              '
+ '				<div class="top">                                                                                                                   '
+ '					<p>#{ml_bank_logid}&nbsp;#{BANK_LOGID}</p>                                                                                                             '
+ '				</div>                                                                                                                              '
+ '			</div>                                                                                                      						'
+ '			<ul class="item-table">                                                                                                             '
+ '				<li class="mt10">                                                                                                               '
+ '					<div class="required">#{Question}</div>                                                '
+ '					<div>                                                                                                                       '
+ '						<div class="select-box-default-st" style="width:100%;">                                                                 '
+ '							<input type="text" value="" title="value" id="" name="req" class="selectValue wd-100p" readonly placeholder="#{Question_Placeholder}" />  '
+ '							<div class="select-wrap">                                                                                           '
+ '								<ul id="selectList0" class="select-box-option">                                                                 '
+ '									#{QNA_LIST}                                                                                                 '
+ '								</ul>                                                                                                           '
+ '							</div>                                                                                                              '
+ '						</div>					                                                                                                '
+ '					</div>                                                                                                                      '
+ '				</li>                                                                                                                           '
+ '				<li>                                                                                                                            '
+ '					<div class="required">#{Answer}</div>                                                  '
+ '					<div class="input-clear-box">                                                                                               '
+ '						<label for="text[1]"></label>                                                                                           '
+ '						<input type="text" size="" id="text[1]" name="res" value="" class="wd-100p" placeholder="#{Answer_Placeholder}" /> '
+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                                      '
+ '					</div>                                                                                                                      '
+ '				</li>                                                                                                                           '
+ '			</ul>                                                                                                                               '
+ '		</div>                                                                                                                                  '
+ '		<div id="btn-wrap-default" class="tar">                                                                                                 '
+ '			<div class="btn-area">                                                                                                              '
+ '				<a href="javascript:void(0);" class="btn-st common cancel">#{CANCEL}</a>                                           '
+ '				<a href="javascript:void(0);" class="btn-st primary save">#{CONFIRM}</a>                                              '
+ '			</div>                                                                                                                              '
+ '		</div>                                                                                                                                  '
+ '		</form>                                                                                                                                 '
+ '	</div>                                                                                                                                      '
+ '</div>                                                                                                                                       ';

_password_template = ''
	+ '<!-- S :: WABOOK-LAYERPOPUP-DEFAULT - ACCOUNT MANAGEMENT -->                                                                                                                                                                  '
	+ '<div class="layerCont account-management" for="#{THREAD_INDEX}">                                                                                                                                                              '
	+ '	<div class="layerPopup-close close_putpassword"></div>                                                                                                                                                                                         '
	+ '	<h1>Account Management</h1>                                                                                                                                                                                                  '
	+ '	<div class="layerPopupWrap">                                                                                                                                                                                                 '
	+ '		<form method="post" action="">                                                                                                                                                                                           '
	+ '		<div id="layerPopup-contsBox">                                                                                                                                                                                           '
	+ '			<div class="top">                                                                                                                                                                                                    '
	+ '				<p>Please enter the <b>#{BANK_NM}</b>\'s banking credentials.</p>                                                                                                                                                                     '
	+ '				<figure><img src="#{BANK_IMG}" alt="" /></figure>                                                                                                                                      '
	+ '			</div>                                                                                                                                                                                                               '
	+ '			<ul class="item-table">                                                                                                                                                                                              '
	+ '				<li class="cert_info_detl_con2">                                                                                                                                                                                 '
	+ '					<div class="required">#{CERT_INFO_DETL_CON2}</div>                                                                                                                                                           '
	+ '					<div class="input-clear-box">                                                                                                                                                                                '
	+ '						<label for="CERT_INFO_DETL_CON2"></label>                                                                                                                                                                '
	+ '						<input type="text" size="" id="CERT_INFO_DETL_CON2" name="" value="#{CERT_INFO_DETL_CON2_VAL}" class="wd-100p disabled" disabled data-collname="#{CERT_INFO_DETL_CON2}" />                               '
	+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                                                                                                                       '
	+ '					</div>                                                                                                                                                                                                       '
	+ '				</li>                                                                                                                                                                                                            '
	+ '				<li class="cert_info_con">                                                                                                                                                                                       '
	+ '					<div class="required">#{CERT_INFO_CON}</div>                                                                                                                                                                 '
	+ '					<div class="input-clear-box">                                                                                                                                                                                '
	+ '						<label for="CERT_INFO_CON"></label>                                                                                                                                                                      '
	+ '						<input type="text" size="" id="CERT_INFO_CON" name="" value="#{CERT_INFO_CON_VAL}" class="wd-100p disabled" disabled data-collname="#{CERT_INFO_CON}" />                                                 '
	+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                                                                                                                       '
	+ '					</div>                                                                                                                                                                                                       '
	+ '				</li>                                                                                                                                                                                                            '
	+ '				<li class="cert_info_detl_con1">                                                                                                                                                                                 '
	+ '					<div class="required">#{CERT_INFO_DETL_CON}</div>                                                                                                                                  '
	+ '					<div class="input-clear-box">                                                                                                                                                                                '
	+ '						<label for="CERT_INFO_DETL_CON"></label>                                                                                                                                                                 '
	+ '						<input type="password" size="" id="CERT_INFO_DETL_CON" name="" value="" class="wd-100p" placeholder="#{CERT_INFO_DETL_CON_PL}" data-require="true" data-collname="#{CERT_INFO_DETL_CON}" />                  '
	+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                                                                                                                       '
	+ '					</div>                                                                                                                                                                                                       '
	+ '				</li>                                                                                                                                                                                                            '
	+ '				<li class="cert_info_detl_con11">                                                                                                                                                                                '
	+ '					<div class="required">#{CERT_INFO_DETL_CON_2}</div>                                                                                                                     '
	+ '					<div class="input-clear-box">                                                                                                                                                                                '
	+ '						<label for="CERT_INFO_DETL_CON_2"></label>                                                                                                                                                               '
	+ '						<input type="password" size="" id="CERT_INFO_DETL_CON_2" name="" value="" class="wd-100p" placeholder="#{CERT_INFO_DETL_CON_2_PL}" data-collname="#{CERT_INFO_DETL_CON_2}" />           '
	+ '						<button class="btnInputClear" style="visibility:hidden;"></button>                                                                                                                                       '
	+ '					</div>                                                                                                                                                                                                       '
	+ '				</li>                                                                                                                                                                                                            '
	+ '			</ul>                                                                                                                                                                                                                '
	+ '		</div>                                                                                                                                                                                                                   '
	+ '		<div id="btn-wrap-default" class="">                                                                                                                                                                                     '
	+ '			<div>                                                                                                                                                                                                                '
	+ '				<input type="checkbox" name="" id="REG_CERT_INFO_DETL_CON_YN" class="checkBox-normal">                                                                                                                           '
	+ '				<label for="REG_CERT_INFO_DETL_CON_YN">#{SAVE_PASSWORD}</label>                                                                                                         '
	+ '			</div>                                                                                                                                                                                                               '
	+ '			<div class="btn-area">                                                                                                                                                                                               '
	+ '				<a href="javascript:void(0);" class="btn-st common back cancel_putpassword">#{CANCEL}</a>                                                                                                       '
	+ '				<a href="javascript:void(0);" class="btn-st primary save save_putpassword">#{CONFIRM}</a>                                                                                                     '
	+ '			</div>                                                                                                                                                                                                               '
	+ '		</div>                                                                                                                                                                                                                   '
	+ '		</form>                                                                                                                                                                                                                  '
	+ '	</div>                                                                                                                                                                                                                       '
	+ '</div>                                                                                                                                                                                                                        '
	+ '<!-- E :: WABOOK-LAYERPOPUP-DEFAULT - ACCOUNT MANAGEMENT -->                                                                                                                                                                  ';
	
_non_installed_message = ""
	+ '<div class="layerCont alert">                                                                                                                '
	+ '	<div class="layerPopupWrap">                                                                                                                            '
	+ '		<div id="layerPopup-contsBox">                                                                                                                      '
	+ '			<div class="conts">                                                                                                                             '
	+ '				<figure class="tac"><img src="/assets_v2/images/common/icon-information.png" alt="" /></figure>                                             '
	+ '				<div class="title tac">#{NON_INSTALL_TITLE}</div>                                                                                           '
	+ '				<div class="desc">                                                                                                                          '
	+ '					<p>#{CONTENT_1}</p> '
	+ '					<p class="mt20">#{CONTENT_2}</p>			'		
	+ '					<ul class="mt20">                                                                                                                       '
	+ '						<li>#{CONTENT_3}</li>                                                                         '
	+ '						<li class="dot-line">#{CONTENT_4}</li>                                                                                               '
	+ '						<li class="dot-line">#{CONTENT_5}</li>                                                                                              '
	+ '						<li class="dot-line">#{CONTENT_6}</li>                                                   '
	+ '					</ul>                                                                                                                                   '
	+ '					<ul class="mt20">                                                                                                                       '
	+ '						<li>#{CONTENT_8}</li>                                       '
	+ '						<li>#{CONTENT_9}</li>                                                                                   '
	+ '						<li>#{CONTENT_10}</li>                                                                                          '
	+ '					</ul>					                                                                                                                '
	+ '				</div>                                                                                                                                      '
	+ '			</div>                                                                                                                                          '
	+ '		</div>                                                                                                                                              '
	+ '		<div id="btn-wrap-default" class="tar">                                                                                                             '
	+ '			<div class="btn-area">                                                                                                                          '
	+ '				<a href="javascript:void(0);" class="btn-st primary nxisas_download">#{CONTENT_11}</a>                                                     '
	+ '			</div>                                                                                                                                          '
	+ '		</div>                                                                                                                                              '
	+ '	</div>                                                                                                                                                  '
	+ '</div>                                                                                                                                                   ';	

_non_winos_message = ""
	+ '<div class="layerCont alert">                                                                                                                '
	+ '	<div class="layerPopupWrap">                                                                                                                            '
	+ '		<div id="layerPopup-contsBox">                                                                                                                      '
	+ '			<div class="conts">                                                                                                                             '
	+ '				<figure class="tac"><img src="/assets_v2/images/common/icon-information.png" alt="" /></figure>                                             '
	+ '				<div class="title tac">#{NON_WINOS_TITLE}</div>                                                                                           '
	+ '				<div class="desc">                                                                                                                          '
	+ '					<ul>                                                                                                                                   '
	+ '						<li>#{CONTENT_1}</li>                                                                                                               '
	+ '						<li class="dot-line">#{CONTENT_2}</li>                                                                                               '
	+ '						<li class="dot-line">#{CONTENT_3}</li>                                                                                              '
	+ '						<li>#{CONTENT_4}</li>                                                                                                               '
	+ '						<li class="dot-line">#{CONTENT_5}</li>                                                                                              '
	+ '					</ul>                                                                                                                                   '
	+ '				</div>                                                                                                                                      '
	+ '			</div>                                                                                                                                          '
	+ '		</div>                                                                                                                                              '
	+ '		<div id="btn-wrap-default" class="tar">                                                                                                             '
	+ '			<div class="btn-area">                                                                                                                          '
	+ '				<a href="javascript:void(0);" class="btn-st primary close">#{CONTENT_6}</a>                                                                 '
	+ '			</div>                                                                                                                                          '
	+ '		</div>                                                                                                                                              '
	+ '	</div>                                                                                                                                                  '
	+ '</div>                                                                                                                                                   ';	


_confirm_transfer_template = ""
+ '<!-- S ::2023-05-25 WABOOK-LAYERPOPUP-DEFAULT - TRANSFER-COTACTS -->'
+ '<div class="layerCont middle transfer_confirmation" for="#{THREAD_INDEX}" for2="#{2NDCERT_INDEX}" data-type="#{TYPE_POPUP}">                                                                                                                       '
+ '	<h1>#{ML_TRNS_CONF}</h1>                                                                                                                                            '
+ '	<div class="layerPopupWrap">                                                                                                                                              '
+ '		<form method="post" action="">                                                                                                                                        '
+ '		<div id="layerPopup-contsBox" class="scroll-bar-custom">                                                                                                              '
+ '			<div class="formList-wrap">		                                                                                                                                  '
+ '				<div class="form-cont">                                                                                                                                       '
+ '					<div class="title">                                                                                                                                       '
+ '						<div class="topic">                                                                                                                                   '
+ '							#{ML_SND_ACCT_INFO}                                                                                                                        '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '					<div class="ip-cont">                                                                                                                                     '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name">#{ML_SND_ACCT}</div>                                                                                                            '
+ '							<div class="inputCont">                                                                                                                           '
+ '								<p class="val">#{SND_ACCT}</p>                                                                                                  '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name">#{ML_TRNS_AMT}</div>                                                                                                           '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{TRNS_AMT}</p>                                                                                                                 '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '				</div>                                                                                                                                                        '
+ '				<div class="form-cont">                                                                                                                                       '
+ '					<div class="title">                                                                                                                                       '
+ '						<div class="topic">#{ML_RECP_ACCT_INFO}</div>                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '					<div class="ip-cont">                                                                                                                                     '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name">#{ML_RECP_BANK}</div>                                                                                                            '
+ '							<div class="inputCont">                                                                                                                           '
+ '								<p class="val">#{RECP_BANK}</p>                                                                      '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name">#{ML_RECP_ACCT_NO}</div>                                                                                                     '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{RECP_ACCT_NO}</p>                                                                                                             '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name">#{ML_RECP_NM}</div>                                                                                                            '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{RECP_NM}</p>                                                                                                    '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '				</div>                                                                                                                                                        '
+ '				<div class="form-cont">                                                                                                                                       '
+ '					<div class="title">                                                                                                                                       '
+ '						<div class="topic">#{ML_TRNS_DETL}</div>                                                                                                          '
+ '					</div>                                                                                                                                                    '
+ '					<div class="ip-cont">                                                                                                                                     '
+ '						<div class="ip-list displayflex" style="#{TRNS_FEE_STTS_AREA}">                                                                                                                     '
+ '							<div class="name">#{ML_TRNS_FEE}</div>                                                                                                           '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{TRNS_FEE_STTS}</p>                                                                                                                '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '						<div class="ip-list displayflex" style="#{TRNS_FEE_AMT_AREA}">                                                                                                                     '
+ '							<div class="name">#{ML_TRNS_FEE_AMT}</div>                                                                                                                '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{TRNS_FEE_AMT}</p>                                                                                                                      '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '						<div class="ip-list displayflex" style="#{TRNS_RMRK_AREA}">                                                                                                                     '
+ '							<div class="name">#{ML_TRNS_RMRK}</div>                                                                                                                    '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{TRNS_REMARK}</p>                                                                                             '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '						<div class="ip-list displayflex" style="#{TRNS_RMRK_SENDER_AREA}">                                                                                                                     '
+ '							<div class="name">#{ML_TRNS_RMRK_SND}</div>                                                                                                                    '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{TRNS_RMRK_SENDER}</p>                                                                                             '
+ '							</div>	                                                                                                                                          '
+ '						</div>'
+ '						<div class="ip-list displayflex" style="#{TRNS_RMRK_RECP_AREA}">                                                                                                                     '
+ '							<div class="name">#{ML_TRNS_RMRK_RECP}</div>                                                                                                                    '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<p class="val">#{TRNS_RMRK_RECP}</p>                                                                                             '
+ '							</div>	                                                                                                                                          '
+ '						</div>'
+ '					</div>                                                                                                                                                    '
+ '				</div>                                                                                                                                                        '
+ '			</div>                                                                                                                                                            '
+ '			<div class="formList-wrap" style="#{PWD_AREA}">		                                                                                                                                  '
+ '				<div class="form-cont" style="#{OTP_PWD_AREA}" id="OTP_PWD">                                                                                                                                       '
+ '					<div class="title">                                                                                                                                       '
+ '						<div class="topic">                                                                                                                                 '
+ '							<span>OTP</span>&nbsp;<span id="SHI_PWD" style="#{SHI_PWD}">#{ADDITIONAL_INFO}</span>                                                                                                                                            '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '					<div class="ip-cont">                                                                                                                                     '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name" style="margin-top: -30px;">#{ML_OTP_PASSWORD}</div>                                                                                                             '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ ' 							<div class="displayflex">'
+ '									<div>'
+ '										<div class="input-pass-box">                                                                                                                  '
+ '											<label for="text[8]"></label>                                                                                                             '
+ '											<input type="password" size="20" id="text[8]" name="otp_pwd" value="" placeholder="">                                     '
+ '											<button class="btnInputEye" style="visibility: hidden"></button>                                                                          '
+ '										</div>                                                                                                                                        '
+ '										<p class="id_label">(ID: #{USER_NAME})</p>                                                                                                      '
+ '									</div>'
+ ' 							</div>'
+ ' 							<div class="otp-wrap codeImg_none ml60"> '
+ ' 								<div class="code" style="margin-top: -30px;">'
+ '										<p class="qr-tit">#{ML_TRANSACTION_CODE}</p>'
+ '										<p class="code-num">#{ADDITIONAL_INFO}</p>'
+ '									</div>'
+ '								</div>'
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '				</div>                                                                                                                                                        '
+ '				<div class="form-cont" style= "margin-top: 0px !important; border-top: 0px !important; display:none" id="TRNS_PWD">                                                                                                                                       '
+ '					<div class="title">                                                                                                                                       '
+ '						<div class="topic">                                                                                                                                   '
+ '							#{ML_TRNS_PWD}                                                                                                                                 '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '					<div class="ip-cont">                                                                                                                                     '
+ '						<div class="ip-list displayflex">                                                                                                                     '
+ '							<div class="name">#{ML_TRANSFER_PASSWORD}</div>                                                                                                        '
+ '							<div class="inputCont displayflex">                                                                                                               '
+ '								<div class="input-pass-box">                                                                                                                  '
+ '									<label for="text[8]"></label>                                                                                                             '
+ '									<input type="password" size="40" id="text[8]" name="trns_pwd" value="" placeholder="#{ENTER_TRANSFER_PASSWORD}">                                     '
+ '									<button class="btnInputEye" style="visibility: hidden"></button>                                                                          '
+ '								</div>                                                                                                                                        '
+ '								<p class="id_label">(ID: #{USER_NAME})</p>                                                                                                      '
+ '							</div>	                                                                                                                                          '
+ '						</div>                                                                                                                                                '
+ '					</div>                                                                                                                                                    '
+ '				</div>                                                                                                                                                        '
+ '			</div>                                                                                                                                                            '
+ '                                                                                                                                                                           '
+ '		</div>                                                                                                                                                                '
+ '		<div id="btn-wrap-default" class="tac">                                                                                                                               '
+ '			<div class="btn-area">                                                                                                                                            '
+ '				<a href="javascript:void(0);" class="btn-st normal cancel">#{CANCEL}</a>                                                                                          '
+ '				<a href="javascript:void(0);" class="btn-st primary confirm w340">#{CONFIRM}</a>                                                                                 '
+ '			</div>                                                                                                                                                            '
+ '		</div>                                                                                                                                                                '
+ '		</form>                                                                                                                                                               '
+ '	</div>                                                                                                                                                                    '
+ '</div>                                                                                                                                                                     '
+ '<!-- E :: WABOOK-LAYERPOPUP-DEFAULT - TRANSFER-COTACTS --> ';                                                                                                                 

_v2nxisas = {
	
	loadedNxisas : true,			// NXISAS 모듈 로딩 여부
	orgObj: null,					// 업무단에서 보낸 데이터객체
	nxisasObj: null,				// 업무단에서 보낸 데이터객체를 nxisas 전문에 맞게 변형한 객체
	_finishedCount: 0,				// 스크래핑이 완료된 Thread 갯수
	_2ndCertList: null,				// 2단계 인증(OTP, CAPTCHA, QUESTION, ...) 대기 리스트
	//_2ndCertIndex: null,			// 현재 진행중인 2단계 인증 Index
	//_2ndCertCompletedIndex: 0,		// 2단계 인증 완료 Index
	ThreadLength: 0,				// 스크래핑 스레드 갯수
	callback: null,					// 전체 스크래핑 완료 후 콜백 함수
	unit_callback: null,			// 스레드별 스크래핑 완료 후 콜백 함수
	job_callback: null,			// 각 Job별 스크래핑 완료 후 콜백 함수 (해당 콜백함수는 isasscraping.js의 ONCOMPLETED부에서 호출함.)
	
	progress: false,					// 프로그레스 Layer 표시여부
	_loginFinishCount: 0,			// 로그인 완료(성공, 실패에 관계없이) Count
	
	_2ndCertProcessing: false,		// 2차인증 진행중 여부
	
	_2ndCertProcessingNonLogin: false,			// 로그인을 제외한 다른 업무에서 2차인증 진행중 여부
	_2ndCertFinishCount: 0,			// 2차인증 성공(로그인을 제외한 다른 업무에서 2차 인증을 할 때 쓰는 Flag) Count
	
	_GDTCaptchaTryCount: 0,		// Vietnam GDT captcha 인증 시도 횟수
	
	_headerList: {},				// 스크래핑 Header정보 List
	
	_nxsasLogInd:0,
	_nxsasResInd:0,

	openNxisas : function(callback) {
		
		if (platform.os.family.indexOf('Windows') < 0) {
			var _template = _non_winos_message;
			_template = _template.replaceAll('#{NON_WINOS_TITLE}', jexML.get("nxisas_v2_j027", "System requirements for Real-Time Online Inquiry"));
			_template = _template.replaceAll('#{CONTENT_1}', jexML.get("nxisas_v2_j028", "WABOOKS's Real-Time Online Inquiry will be configured on"));
			_template = _template.replaceAll('#{CONTENT_2}', jexML.get("nxisas_v2_j029", "Device : PC"));
			_template = _template.replaceAll('#{CONTENT_3}', jexML.get("nxisas_v2_j030", "OS : Windows"));
			_template = _template.replaceAll('#{CONTENT_4}', jexML.get("nxisas_v2_j031", "*Note: macOS is not supported."));
//			_template = _template.replaceAll('#{CONTENT_5}', jexML.get("nxisas_v2_j032", "Browser : All (Chrome, Edge, Safari, Firefox, Opera...)"));
			_template = _template.replaceAll('#{CONTENT_5}', jexML.get("nxisas_v2_j032", "Browser : Chrome(recommended)"));
			_template = _template.replaceAll('#{CONTENT_6}', jexML.get("nxisas_v2_j033", "Close"));
			var _popup = $(_template);
			var _popupName = _v2common.app.getPopupName(_popup);
			_popup.attr('fromPopup', _popupName);
			$('body').append(_popup);					
			_v2common.app.enableLayerPopup(_popupName);		
			callback(false);
		} else {
			/* NXISAS Module Setup Check and Initialize */
			CooconiSASNX.init( function (b){
				//실행가능여부
				if(!b){
					//설치페이지 이동
					//alert('스크래핑 모듈 설치 후 이용하시기 바랍니다.');
					if (typeof(callback) == 'function') {
						var _template = _non_installed_message;
						var getLang = _osmc.ui.getLocalLanguage();
						_template = _template.replaceAll('#{NON_INSTALL_TITLE}', jexML.get("nxisas_v2_j015", "Download and Install the WABOOKS Program"));
						_template = _template.replaceAll('#{CONTENT_1}', jexML.get("nxisas_v2_j016", " "));
						_template = _template.replaceAll('#{CONTENT_2}', jexML.get("nxisas_v2_j017", "To enable WABOOKS powerful features for getting real-time banking information such as account balance and transaction history, please click <strong>'Download'</strong> button at the bottom and install the program."));
						_template = _template.replaceAll('#{CONTENT_3}', jexML.get("nxisas_v2_j018", "Recommended Requirements"));
						_template = _template.replaceAll('#{CONTENT_4}', jexML.get("nxisas_v2_j019", "Device : PC"));
						_template = _template.replaceAll('#{CONTENT_5}', jexML.get("nxisas_v2_j020", "OS : Microsoft Windows"));
						
//						_template = _template.replaceAll('#{CONTENT_6}', jexML.get("nxisas_v2_j021", "Browser : All (Chrome, Edge, Safari, Firefox, Opera...)"));
//						_template = _template.replaceAll('#{CONTENT_7}', jexML.get("nxisas_v2_j022", " "));	
						
						_template = _template.replaceAll('#{CONTENT_6}', jexML.get("nxisas_v2_j021", "Browser : CHROME (Latest version)"));
						_template = _template.replaceAll('#{CONTENT_8}', jexML.get("nxisas_v2_j023", "Contact Us for Troubleshooting"));
						
						if (getLang.match('VI')) {
						    _template = _template.replaceAll('#{CONTENT_9}', jexML.get("nxisas_v2_j038", "ZALO :  0899422099 [베트남어, 영어]"));
						    _template = _template.replaceAll('#{CONTENT_10}', jexML.get("nxisas_v2_j039", "KAKAO : wabooksvn [한국어]"));
						} else if (getLang.match('KM')) {
						    _template = _template.replaceAll('#{CONTENT_9}', jexML.get("nxisas_v2_j024", "Tel : (+855) 23 900 534 [Khmer, English]"));
						    _template = _template.replaceAll('#{CONTENT_10}', jexML.get("nxisas_v2_j025", "       (+855) 23 900 531 [Korean]"));
						}
						_template = _template.replaceAll('#{CONTENT_11}', jexML.get("nxisas_v2_j026", "Download"));
						var _popup = $(_template);
						var _popupName = _v2common.app.getPopupName(_popup);
						_popup.attr('fromPopup', _popupName);
						$('body').append(_popup);					
						_v2common.app.enableLayerPopup(_popupName);
						callback(false);
						return;
					}
					//return;
				}
				CooconiSASNX.open(0, function(){
					_v2nxisas.loadedNxisas = true;
					
					if (typeof(callback) == 'function') {
						callback(true);
					}
				} );
			});					
		}		
	},
	
	makeThread : function() {
	},
	
	makeHeader : function(bankCd, seqno, job) {
		if (null != seqno && null == job) {
			job = seqno;
			seqno = '0';
		}
		var _header = {};
		if (_isOsmc) {
			if ('undefined' != typeof(_v2nxisas._headerList[bankCd]) && null != _v2nxisas._headerList[bankCd] && bankCd === 'VIETNAM_GDT') {
				_header.Module = _v2nxisas._headerList[bankCd].MODULE;
				_header.Class = _v2nxisas._headerList[bankCd].CLASS;				
			} else {
				var jexAjax = jexjs.createAjaxUtil("nxisas_getModuleInfo");
				var input = {};
				if ('VIETNAM_GDT' == bankCd) {
					input.API_ID = "NTS_NTS001_00001";
				} else {
					input.API_ID = "BNK_BNK001_"+bankCd;	
				}
				
				if ('0' != seqno) {
					input.API_ID += "_"+seqno;	
				}
				
				jexAjax.setting({ 'suffix': ".jct" });
				jexAjax.set(input);
				jexAjax.setting('async', false);
				jexAjax.execute(function (rData) {
					if (jexjs.isJexError(rData)) {
						top.tmsComm.destroyProgressBar();
						_v2common.app.showMessage(rData);
						return null;
					}
					
					_header.Module = rData.MODULE;
					_header.Class = rData.CLASS;
					
					_v2nxisas._headerList[bankCd] = rData;
				});				
			}
		} else {
			_header.Module = jexjs.getCode("NXISAS_MODULE", bankCd);
			_header.Class = jexjs.getCode("NXISAS_CLASS", bankCd);			
		}
		//_header.isas_mode = 'dev';
		_header.Job = job;
		_header.ErrorLang = jexjs.getLang();		
		return _header;
	},
	
	makeLoginInput : function(ind, isUnitLogin, callback) {
		if (_v2nxisas.loadedNxisas && null != _v2nxisas.orgObj) {
			if (null == ind) {
				_v2nxisas.nxisasObj = [];
			}
			
			if (null != ind) {
				var obj = _v2nxisas.orgObj[ind];
				
				if (typeof(obj.nonLogin) == 'undefined' || !obj.nonLogin) {
					var _loginObj = [];
					var _header = _v2nxisas.makeHeader(obj.bankCd, (!jexjs.empty(obj.nxisasGbSeqNo) ? obj.nxisasGbSeqNo : '0'), 'LOGIN');
					var _input = {};
					_input.loginType = 'ID';

					//SCBank>loginType = S2BAPP_OTP
					if(obj.bankCd == "11704104"){
						_input.loginType = 'S2BAPP_OTP';
					}

					/* Vietcom (Personal Banking) */
					if(obj.bankCd == "11704004" && obj.nxisasGbSeqNo == "2"){
						_input.loginType = obj.loginType;
					}

					/* ABBank (An Binh Commercial Joint Stock Bank) (Default Banking)*/
					if(obj.bankCd == "11704106"){
						_input.loginType = obj.loginType;
					}

					// Testing ABBank
					if('11704106' == obj.bankCd){
						_input.loginType = "";
					}

					_input.loginID = obj.loginID;
					_input.loginPWD = obj.loginPWD;
					if (_header.Module.indexOf("GLOBAL/GBL") >= 0 || _header.Module.indexOf("GLOBAL/APA") >= 0) {
						_input.countryCode = _nxisas_country_code;
					}
					if (null != obj.corporateID) {
						_input.corporateID = obj.corporateID;
					}
					if (null != obj.loginPWD1) {
						_input.loginPWD1 = obj.loginPWD1;
					}				
					_header.Input = _input;
					_loginObj.push(_header);
					_v2nxisas.nxisasObj[ind] = _loginObj;
					
					if (null == _input.loginPWD) {
						_v2nxisas.putPassword(ind, obj, function(val) {
							if (null != val) {
								_input.loginPWD = val;
								if (isUnitLogin) {
									callback();	
								} else {
									if (ind == _v2nxisas.orgObj.length-1) {
										callback();
									} else {
										_v2nxisas.makeLoginInput(++ind, isUnitLogin, callback);
									}						
								}							
							} else {
								if (ind == _v2nxisas.orgObj.length-1) {
									callback();
								} else {
									_v2nxisas.makeLoginInput(++ind, isUnitLogin, callback);
								}							
							}						
						});
					} else {
						if (isUnitLogin) {
							callback();	
						} else {
							if (ind == _v2nxisas.orgObj.length-1) {
								callback();
							} else {
								_v2nxisas.makeLoginInput(++ind, isUnitLogin, callback);
							}						
						}
					}						
				}
				else {
					if (ind == _v2nxisas.orgObj.length-1) {
						callback();
					} else {
						_v2nxisas.makeLoginInput(++ind, isUnitLogin, callback);
					}								
				}
			} else {
				ind = 0;
				_v2nxisas.makeLoginInput(ind, isUnitLogin, callback);
			}
		}	
	},
	
	makeJobInput : function(ind) {
		if (_v2nxisas.loadedNxisas && null != _v2nxisas.orgObj) {
			var obj = _v2nxisas.orgObj[ind];
			if (typeof(obj.job) != 'undefined') {
				$.each(obj.job, function(ind1, obj1) {
					var _header = _v2nxisas.makeHeader(obj.bankCd, (!jexjs.empty(obj.nxisasGbSeqNo) ? obj.nxisasGbSeqNo : '0'), obj1.Job);
					var _input = obj1.Input;
					_header.Input = _input;					
					//_jobObj.push(_header);
					_v2nxisas.nxisasObj[ind].push(_header);
				});							
			} else if (typeof(obj[0].Job) != 'undefined') {
				$.each(obj, function(ind1, obj1) {
					var _header = _v2nxisas.makeHeader(obj1.bankCd, (!jexjs.empty(obj1.nxisasGbSeqNo) ? obj1.nxisasGbSeqNo : '0'), obj1.Job);
					var _input = obj1.Input;
					_header.Input = _input;					
					//_jobObj.push(_header);
					_v2nxisas.nxisasObj[ind].push(_header);					
				});				
			}
		}		
	},
	
	makeLogOutInput : function(ind) {
		if (_v2nxisas.loadedNxisas && null != _v2nxisas.orgObj) {
			var obj = _v2nxisas.orgObj[ind];
			if (typeof(obj.job) != 'undefined') {
				if (typeof(obj.nonLogout) == 'undefined' || !obj.nonLogout) {
					var _header = _v2nxisas.makeHeader(obj.bankCd, (!jexjs.empty(obj.nxisasGbSeqNo) ? obj.nxisasGbSeqNo : '0'), 'LOGOUT');
					var _input = {};
					_header.Input = _input;
					_v2nxisas.nxisasObj[ind].push(_header);				
				}				
			} else if (typeof(obj[0]) != 'undefined' && typeof(obj[0].Job) != 'undefined') {
				if (typeof(obj[0].nonLogout) == 'undefined' || !obj[0].nonLogout) {
					var _header = _v2nxisas.makeHeader(obj[0].bankCd, (!jexjs.empty(obj[0].nxisasGbSeqNo) ? obj[0].nxisasGbSeqNo : '0'), 'LOGOUT');
					var _input = {};
					_header.Input = _input;
					_v2nxisas.nxisasObj[ind].push(_header);				
				}				
			} else if (null != obj) {
				if (typeof(obj.nonLogout) == 'undefined' || !obj.nonLogout) {
					var _header = _v2nxisas.makeHeader(obj.bankCd, (!jexjs.empty(obj.nxisasGbSeqNo) ? obj.nxisasGbSeqNo : '0'), 'LOGOUT');
					var _input = {};
					_header.Input = _input;
					_v2nxisas.nxisasObj[ind].push(_header);				
				}				
			}
		}			
	},	
	
	_putPasswordCallback : null,
	
	getPasswordFieldInfo : function(bankCd, seqNo, callback) {
		if (typeof(seqNo) == 'function' && null == callback) {
			callback = seqNo;
			seqNo = '0';
		}
		if (jexjs.empty(seqNo)) { seqNo = '0'; }
		seqNo = '' + seqNo;

		var jexAjax = jexjs.createAjaxUtil("nxisas_getCertFormInfo");
		var input = {};
		var _dataObj = {};
		input.BANK_CD = bankCd;
		input.LANG_CODE = jexjs.getLang();
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(input);
		jexAjax.setting('async', false);
		jexAjax.execute(function (rData) {
			if (jexjs.isJexError(rData)) {
				top.tmsComm.destroyProgressBar();
				_v2common.app.showMessage(rData);
				return;
			}
			
			// console.log("rData >>>" , rData)
			// console.log("rData.REC[0] >>>" , rData.REC[0])
			// console.log("rData.REC[0].REC1 >>>" , rData.REC[0].REC1)
			
			_dataObj.BANK_GB = '';
			rData.REC = rData.REC.filter(function(item) { return item.SEQ_NM !== 'Personal Banking'; });
			if (rData.REC.length > 1) {
				$.each(rData.REC, function(ind, obj) {
					var _input = "<input type='radio' name='NXISAS_GB_SEQ_NO' id='NXISAS_GB_SEQ_NO_"+obj.SEQ_NO+"' value='"+ obj.SEQ_NO + "' class='radioBtn-normal' "+ (seqNo == ''+ind ? "checked" : "") + " />";
					_dataObj.BANK_GB += _input;
					var _label = "<label for='NXISAS_GB_SEQ_NO_"+obj.SEQ_NO+"' style='display:inline-flex; padding-right:10px;'>"+ obj.SEQ_NM +"</label>";
					_dataObj.BANK_GB += _label;
				});
			}
			
			
			
			// console.log("rData2 >>>" , rData)
			// console.log("rData.REC[0]2 >>>" , rData.REC[0])
			// console.log("rData.REC[0].REC1 2 >>>" , rData.REC[0].REC1)
			
			rData.REC = rData.REC.filter(function (elem) {
				return elem.SEQ_NO === seqNo;
			});
			
			$.each(rData.REC[0].REC1, function(ind, obj) {
				if ('12' == obj.BANK_DETL_INFO_CD) {
					_dataObj.IMG_URL = obj.BANK_DETL_INFO_CONT;
				} else if ('13' == obj.BANK_DETL_INFO_CD || '14' == obj.BANK_DETL_INFO_CD || '15' == obj.BANK_DETL_INFO_CD) {
					_dataObj.CERT_INFO_CON_TITLE = obj.BANK_DETL_INFO_CONT;
				} else if ('16' == obj.BANK_DETL_INFO_CD || '17' == obj.BANK_DETL_INFO_CD || '18' == obj.BANK_DETL_INFO_CD) {
					_dataObj.CERT_INFO_DEL_CON_TITLE = obj.BANK_DETL_INFO_CONT;
				} else if ('19' == obj.BANK_DETL_INFO_CD || '20' == obj.BANK_DETL_INFO_CD || '21' == obj.BANK_DETL_INFO_CD) {
					_dataObj.CERT_INFO_DEL_CON11_TITLE = obj.BANK_DETL_INFO_CONT;
				} else if ('22' == obj.BANK_DETL_INFO_CD || '23' == obj.BANK_DETL_INFO_CD || '24' == obj.BANK_DETL_INFO_CD) {
					_dataObj.CERT_INFO_DEL_CON2_TITLE = obj.BANK_DETL_INFO_CONT;
				}
			});					
			
			callback(_dataObj);
		});			
	},
	
	putPassword : function(ind, obj, callback) {
		if (_v2nxisas.loadedNxisas && null != _v2nxisas.orgObj) {
			var _template = _password_template;
			
			_v2nxisas.getPasswordFieldInfo(obj.bankCd, obj.nxisasGbSeqNo, function(result) {
				_template = _template.replaceAll('#{THREAD_INDEX}', ''+ind);
				_template = _template.replaceAll('#{BANK_NM}', ''+obj.bankNm);
				_template = _template.replaceAll('#{BANK_IMG}', ''+result.IMG_URL.replaceAll("{LANG_CODE}", jexjs.getLang()));
				_template = _template.replaceAll('#{CERT_INFO_DETL_CON2}', result.CERT_INFO_DEL_CON2_TITLE);
				
				//console.log("_template", _template)
				//console.log("BANK_NM", obj.bankNm)
				
				if (null != obj.corporateID) {
					_template = _template.replaceAll('#{CERT_INFO_DETL_CON2_VAL}', obj.corporateID);
				}
				if (null != obj.loginPWD1) {
					_template = _template.replaceAll('#{CERT_INFO_DETL_CON2_VAL}', obj.loginPWD1);
				}
				_template = _template.replaceAll('#{CERT_INFO_CON}', result.CERT_INFO_CON_TITLE);
				_template = _template.replaceAll('#{CERT_INFO_CON_VAL}', obj.loginID);			
				_template = _template.replaceAll('#{CERT_INFO_DETL_CON}', result.CERT_INFO_DEL_CON_TITLE);
				_template = _template.replaceAll('#{CERT_INFO_DETL_CON_PL}', jexML.get("nxisas_v2_j013", "Enter Password"));
				_template = _template.replaceAll('#{CERT_INFO_DETL_CON_2}', result.CERT_INFO_DEL_CON11_TITLE);
				_template = _template.replaceAll('#{CERT_INFO_DETL_CON_2_PL}', jexML.get("nxisas_v2_j014", "Enter Password Confirmation"));
				_template = _template.replaceAll('#{SAVE_PASSWORD}', jexML.get("nxisas_v2_j010", "Save this password"));
				_template = _template.replaceAll('#{CANCEL}', jexML.get("nxisas_v2_j011", "Cancel"));
				_template = _template.replaceAll('#{CONFIRM}', jexML.get("nxisas_v2_j012", "Next"));
				
				var _popup = $(_template);
				var _popupName = _v2common.app.getPopupName(_popup);
				_popup.attr('fromPopup', _popupName);
				$('body').append(_popup);
				top.tmsComm.destroyProgressBar();
				_v2nxisas._putPasswordCallback = callback;
				_v2common.app.enableLayerPopup(_popupName, function() {
					var bankCd = obj.bankCd; 
						
		        	/**
		        	 * 캄보디아 기준
		        	 * Corporate ID 입력허용 : CIMB(72), J TRUST ROYAL(44), Vattanac(43), MB(Vietnam)(11704007)
		        	 * loginPWD1 입력허용 : Sacom(64. Username, Password, Identification), UCB(26. User Code, User Name, Passwords)
		        	 */
					if ('00000000000000000072' == bankCd
						|| '00000000000000000044' == bankCd
						|| '00000000000000000043' == bankCd
						|| '00000000000000000026' == bankCd
						|| '00000000000000000064' == bankCd
						|| '11704007' == bankCd
					) {
						if ('00000000000000000064' == bankCd) {		// Sacom Bank는 맨 아래로 내려줘야 함.
							$(".layerCont.account-management .cert_info_detl_con2").appendTo($(".layerCont.account-management .item-table"));
							$(".layerCont.account-management #CERT_INFO_DETL_CON2").attr('type', 'password');
						} else {
							$(".layerCont.account-management .cert_info_detl_con2").prependTo($(".layerCont.account-management .item-table"));
							$(".layerCont.account-management #CERT_INFO_DETL_CON2").attr('type', 'text');
						}
						
						$(".layerCont.account-management .cert_info_detl_con2").show();
						$(".layerCont.account-management #CERT_INFO_DETL_CON2").removeAttr('disabled');
						$(".layerCont.account-management #CERT_INFO_DETL_CON2").removeClass('disabled');
						$(".layerCont.account-management #CERT_INFO_DETL_CON2").attr('data-require', true);
					} else {
						$(".layerCont.account-management .cert_info_detl_con2").hide();
					}				
				});							
			});
		}
	},
	
	run2ndCert : function(ind, obj, sind) {
		if (_v2nxisas.loadedNxisas && null != _v2nxisas.orgObj) {
			_v2nxisas.make2ndCertInput(ind, obj);
			
			console.log("run2ndCert obj>> "+obj);
			var _2ndCert = '';
			if ('CAPTCHA' == obj.CallBackfunc) {
				_2ndCert = _captcha_template;
			} else if ('OTP' == obj.CallBackfunc && typeof(obj.req.transfer) == 'undefined') {
				_2ndCert = _otp_template;
			} else if ('QNA' == obj.CallBackfunc) {
				_2ndCert = _qna_template;
			}else if (typeof(obj.req.transfer) != 'undefined' && ('CONFIRM' == obj.CallBackfunc || 'OTP' == obj.CallBackfunc)){
				_2ndCert = _confirm_transfer_template;
			}
			
			// LIST_SELECTION 인 경우 결재선인 경우에 한해서 'WABOOKS' 라는 이름의 결재선이 있을 경우 해당 결재선을 사용, 그렇지 않으면 첫번째 결재선을 사용하도록 처리.
			if ('LIST_SELECTION' == obj.CallBackfunc && "ApprovalLine" == obj.req.type && typeof(obj.req.req) != 'undefined') {
				var _wabooksApprovalName = null, _wabooksApprovalValue = null, firstApprovalName = null, firstApprovalHiddenValue;
				for (var i=0; i<obj.req.req.length; i++) {
					var _req = obj.req.req[i];
					var OptionArray = _req.Option.split('|');	// 1. ApprovalLine "Option":"|결재선명|총결재자수|기타정보|"
					if ('WABOOKS' == OptionArray[1]) {
						_wabooksApprovalName = _req.Option;
						_wabooksApprovalValue = _req.HiddenValue;
					} 					 					
					if (i == 0) {
						firstApprovalName = _req.Option;
						firstApprovalHiddenValue = _req.HiddenValue;
					}
				}
				
				//console.log("_wabooksApprovalName", _wabooksApprovalName)
				//console.log("_wabooksApprovalValue", _wabooksApprovalValue)
				//console.log("firstApprovalName", firstApprovalName)
				//console.log("firstApprovalHiddenValue", firstApprovalHiddenValue)
				
				var _bankCd = _v2nxisas.orgObj[ind].bankCd;
				var _seqno = (!jexjs.empty(_v2nxisas.orgObj[ind].nxisasGbSeqNo) ? _v2nxisas.orgObj[ind].nxisasGbSeqNo : '0');
				
				var _2ndCertIndex = null;
				if (null != sind) {
					_2ndCertIndex = sind;
				} else {
					_2ndCertIndex = _v2nxisas._2ndCertList.length;
				}				
				
				var _header = _v2nxisas.makeHeader(_bankCd, _seqno, 'LIST_SELECTION');
				
				var _input = {"res" : {"Option" : (null != _wabooksApprovalName ? _wabooksApprovalName : firstApprovalName), "HiddenValue" : (null != _wabooksApprovalValue ? _wabooksApprovalValue : firstApprovalHiddenValue)}};
				_header.Input = _input;
				
				console.log(_header)
				
				_v2nxisas.nxisasObj[ind] = [];
				_v2nxisas.nxisasObj[ind].push(_header);
				
				// 2차인증시도함.
				_v2nxisas.execute(_v2nxisas.nxisasObj[ind], ind, function(res, seq) {			
					if ('undefined' != typeof(res[0].Output.Result.CallBackfunc)) {		// 정상 응답을 하되 CallBackFunc을 다시 내려줄 때가 있음. (오입력이거나 추가인증이 더 필요한 경우.)
						if ('VIETNAM_GDT' == _v2nxisas.orgObj[seq].bankCd) {
							top.tmsComm.destroyProgressBar();
							if (_v2nxisas._GDTCaptchaTryCount >= 3) {
								_v2nxisas.run_afterLoginFail(res, seq);
							} else {
								_v2common.app.showMessage("WBE6121", function() {
									_v2nxisas.makeLoginInput(seq, true, function() {
										_v2nxisas.execute(_v2nxisas.nxisasObj[seq], seq, function(res2, seq2) {
											_v2nxisas.run_afterLoginSuccess(res2, seq2, _2ndCertIndex);	// 2차 인증 재시도를 위해 2차인증 Queue의 Index를 같이 들고 가서 해당 Index의 값을 바꿔치기 해야함. (바꿔치기 안하면 다른 Queue들에 밀리므로.)
										}, function(res2, seq2) {
											_v2nxisas.run_afterLoginFail(res2, seq2);
										});						
									});								
								});									
							}			
						} else {
							_v2nxisas.run2ndCert(ind, res[0].Output.Result, _2ndCertIndex);	// 2차 인증 재시도.			
						}			
					} else {
						//_v2nxisas._2ndCertIndex = null;
						if (_v2nxisas._2ndCertProcessingNonLogin) {
							_v2nxisas._2ndCertFinishCount++;
						} else {
							_v2nxisas._loginFinishCount++;
						}
						
						if(typeof(trns_0001) != "undefined"){
							trns_0001.closeProgressBar();
						} 
						
						_v2nxisas.open2ndCertPop(++_2ndCertIndex);		// 그 다음 2차 인증 시도
						//top.tmsComm.destroyProgressBar();
						
						_v2nxisas.run_afterLoginSuccess(res, seq);		// 성공 응답 시에는 다음 프로세스로 진행.								
					}									
				}, function(res, seq) {
					top.tmsComm.destroyProgressBar();
					if ('80010171' == res[0].Output.ErrorCode || ('undefined' != typeof(res[0].Output.Result) && 'undefined' != typeof(res[0].Output.Result.CallBackfunc))) {		// 2차 인증 오입력 시에는 로그인부터 재시도.
						_v2nxisas.makeLoginInput(seq, true, function() {
							_v2nxisas.execute(_v2nxisas.nxisasObj[seq], seq, function(res2, seq2) {
								_v2nxisas.run_afterLoginSuccess(res2, seq2, _2ndCertIndex);	// 2차 인증 재시도를 위해 2차인증 Queue의 Index를 같이 들고 가서 해당 Index의 값을 바꿔치기 해야함. (바꿔치기 안하면 다른 Queue들에 밀리므로.)
							}, function(res2, seq2) {
								_v2nxisas.run_afterLoginFail(res2, seq2);
							});						
						});								
					} else {
						var _input = {};
						_input.bankCd = _v2nxisas.orgObj[_threadIndex].bankCd;
						_input.loginID = _v2nxisas.orgObj[_threadIndex].loginID;
						res[0].Input = _input;				
						//_v2nxisas._2ndCertIndex++;
						_v2nxisas.run_afterLoginFail(res, seq, _2ndCertIndex);
					}
				});					
			} else if(typeof(obj.req.transfer) != 'undefined' && ('CONFIRM' == obj.CallBackfunc || 'OTP' == obj.CallBackfunc)){
				
				console.log("_v2nxisas.orgObj >> ", _v2nxisas.orgObj[ind])
				//For notice CONFIRM or OTP
				_2ndCert = _2ndCert.replaceAll('#{TYPE_POPUP}', obj.CallBackfunc);
				
				_2ndCert = _2ndCert.replaceAll('#{THREAD_INDEX}', ''+ind);
				if (null != sind) {
					_2ndCert = _2ndCert.replaceAll('#{2NDCERT_INDEX}', ''+sind);
				} else {
					_2ndCert = _2ndCert.replaceAll('#{2NDCERT_INDEX}', ''+_v2nxisas._2ndCertList.length);
				}
				
				var sndBankCd = _v2nxisas.orgObj[ind].bankCd;
				var sndBankNm = _v2nxisas.orgObj[ind].bankNm;
				var userName = _v2nxisas.orgObj[ind].loginID;
				var recpBankNm = (common.app.null2void(_v2nxisas.orgObj[ind].recpBankNm) == "") ? obj.req.transfer[0].remitBank : _v2nxisas.orgObj[ind].recpBankNm;
				var trnsFeeStts = (common.app.null2void(_v2nxisas.orgObj[ind].trnsFeeStts) == "") ? obj.req.transfer[0].feePaymentType : _v2nxisas.orgObj[ind].trnsFeeStts;
				
				var sndCurrency = obj.req.transfer[0].currency;
				var otpPwdArea = "display:none;";
				//var trnsPwdArea = "display:none;"; // more to main page
				var pwdArea = "";
				var trnsFeeSttsArea = "";
				var trnsFeeAmtArea = "";
				var trnsRmrkArea = "";
				var trnsRmrkSenderArea = "display:none;";
				var trnsRmrkRecpArea = "display:none;";
				var hideSinhanOtp = "";
				
				/* Bank info
		        1. BIDV(11704008)
		        2. KEBHana(11704080)
		        3. Shinhan(11704088)
		        4. Vietcom(11704004)
		        5. IBK(11704003) */
		        switch (sndBankCd) {
		            case '11704008': // BIDV
		            	pwdArea = "display:none;";
	                	break;
	           		case '11704003': // IBK
	           			otpPwdArea = "";
	           		 	break;
	           		case '11704088': // Shinhan
	           			otpPwdArea = "";
	           			trnsFeeSttsArea = "display:none;";
	           			hideSinhanOtp = "display:none;"
	           			//trnsFeeAmtArea = "display:none;";
	                	break;
	            	case '11704080': // KEBHana 
		            	pwdArea = "display:none;";
	            		//trnsPwdArea = ""; // more to main page
	            		if("" == sndBankCd){ //internal
	            			trnsRmrkSenderArea = "";
							trnsRmrkRecpArea = "";
						}
	            		break;
            		case '11704004': // Vietcom
	           			otpPwdArea = "";
           		 		break;
           		}
           		//ML 
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_CONF}'	,   jexML.get("nxisas_v2_j042", "Transfer Confirmation"));
				_2ndCert = _2ndCert.replaceAll('#{ML_SND_ACCT_INFO}',   jexML.get("nxisas_v2_j043", "Sender Account Information"));
				_2ndCert = _2ndCert.replaceAll('#{ML_SND_ACCT}'		,   jexML.get("nxisas_v2_j044", "Sender Account"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_AMT}'		,   jexML.get("nxisas_v2_j045", "Transfer Amount"));
				_2ndCert = _2ndCert.replaceAll('#{ML_RECP_ACCT_INFO}',  jexML.get("nxisas_v2_j046", "Recipient Account Information"));
				_2ndCert = _2ndCert.replaceAll('#{ML_RECP_BANK}'	,   jexML.get("nxisas_v2_j047", "Recipient Bank"));
				_2ndCert = _2ndCert.replaceAll('#{ML_RECP_ACCT_NO}'	,   jexML.get("nxisas_v2_j048", "Recipient Account No."));
				_2ndCert = _2ndCert.replaceAll('#{ML_RECP_NM}'		,   jexML.get("nxisas_v2_j056", "Recipient Name"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_DETL}'	,   jexML.get("nxisas_v2_j049", "Transaction Details"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_FEE}'		,   jexML.get("nxisas_v2_j050", "Transaction Fee"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_FEE_AMT}'	,   jexML.get("nxisas_v2_j051", "Fee Amount"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_RMRK}'	,   jexML.get("nxisas_v2_j052", "Remark"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_RMRK_SND}',   jexML.get("nxisas_v2_j053", "Remark (Sender)"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_RMRK_RECP}',  jexML.get("nxisas_v2_j054", "Remark (Recipient)"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRNS_PWD}'		,   jexML.get("nxisas_v2_j055", "Transfer Password"));
				_2ndCert = _2ndCert.replaceAll('#{ML_OTP_PASSWORD}', jexML.get("nxisas_v2_j066", "OTP Password"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRANSACTION_CODE}', jexML.get("nxisas_v2_j067", "Transaction code"));
				_2ndCert = _2ndCert.replaceAll('#{ML_TRANSFER_PASSWORD}', jexML.get("nxisas_v2_j068", "Transfer Password"));
				_2ndCert = _2ndCert.replaceAll('#{ENTER_TRANSFER_PASSWORD}', jexML.get("nxisas_v2_j069", "Enter Transfer Password"));

           		//Option for each bank
				_2ndCert = _2ndCert.replaceAll('#{TRNS_FEE_STTS_AREA}',  trnsFeeSttsArea);
				_2ndCert = _2ndCert.replaceAll('#{TRNS_FEE_AMT_AREA}',  trnsFeeAmtArea);
				_2ndCert = _2ndCert.replaceAll('#{TRNS_RMRK_AREA}',  trnsRmrkArea);
				_2ndCert = _2ndCert.replaceAll('#{TRNS_RMRK_SENDER_AREA}',  trnsRmrkSenderArea);
				_2ndCert = _2ndCert.replaceAll('#{TRNS_RMRK_RECP_AREA}',  trnsRmrkRecpArea);
           		
				_2ndCert = _2ndCert.replaceAll('#{OTP_PWD_AREA}',  otpPwdArea);
				//_2ndCert = _2ndCert.replaceAll('#{TRNS_PWD_AREA}',  trnsPwdArea);
				_2ndCert = _2ndCert.replaceAll('#{PWD_AREA}',  pwdArea);
				_2ndCert = _2ndCert.replaceAll('#{SHI_PWD}',  hideSinhanOtp);
				
				
				//Dispay Information
				_2ndCert = _2ndCert.replaceAll('#{SND_ACCT}', sndBankNm + " " + obj.req.transfer[0].acctNum + " " + "(" + sndCurrency + ")");
				_2ndCert = _2ndCert.replaceAll('#{TRNS_AMT}',  _osmc.ui.formatAmount(parseFloat(obj.req.transfer[0].remitAmt), sndCurrency, false) + " ".concat(sndCurrency));
				//_2ndCert = _2ndCert.replaceAll('#{RECP_BANK}',  obj.req.transfer[0].remitBank);
				_2ndCert = _2ndCert.replaceAll('#{RECP_BANK}',  recpBankNm);
				_2ndCert = _2ndCert.replaceAll('#{RECP_ACCT_NO}',  obj.req.transfer[0].remitAcctNum);
				_2ndCert = _2ndCert.replaceAll('#{RECP_NM}',  obj.req.transfer[0].acceptName);
				//_2ndCert = _2ndCert.replaceAll('#{TRNS_FEE_STTS}',  obj.req.transfer[0].feePaymentType);
				_2ndCert = _2ndCert.replaceAll('#{TRNS_FEE_STTS}',  trnsFeeStts);
				_2ndCert = _2ndCert.replaceAll('#{TRNS_FEE_AMT}',  _osmc.ui.formatAmount(parseFloat(common.app.null2zero(obj.req.transfer[0].fee)), sndCurrency, false) + " ".concat(sndCurrency));
				_2ndCert = _2ndCert.replaceAll('#{TRNS_REMARK}',  obj.req.transfer[0].memo);
				
				_2ndCert = _2ndCert.replaceAll('#{USER_NAME}',  userName);
				
				
				// console.log("Shin CAPTCHA", obj.CallBackfunc)
				// console.log("Shin BANK_INFO", _v2nxisas.orgObj[ind].bankCd)
				// console.log("Shin BANK_INFO", _v2nxisas.orgObj[ind].bankNm)
				
				if (_v2nxisas.orgObj[ind].bankCd == "11704088") {

					if ('OTP' == obj.CallBackfunc) {
						var _option = '';
						$.each(obj.req.req, function(ind, obj) {

							if (typeof(obj.Code) != 'undefined') {
								_option += '' + obj.Code + '';
							}
							
							if(_option != "") _option = "" + _option + "";
						});
						_2ndCert = _2ndCert.replaceAll('#{ADDITIONAL_INFO}', ' ' + _option);
					} else {
						_2ndCert = _2ndCert.replaceAll('#{ADDITIONAL_INFO}', '');
					}

				} else {
					if ('OTP' == obj.CallBackfunc) {
						var _option = '';
						$.each(obj.req.req, function(ind, obj) {
							
							if (typeof(obj.Title) != 'undefined') {
								_option += obj.Title + '';	
							}
							if (typeof(obj.Code) != 'undefined') {
								_option += ':&nbsp;<b>' + obj.Code + '</b>';	
							}
							
							if(_option != "") _option = "(" + _option + ")";
						});
						_2ndCert = _2ndCert.replaceAll('#{ADDITIONAL_INFO}', ' ' + _option);
					} else {
						_2ndCert = _2ndCert.replaceAll('#{ADDITIONAL_INFO}', '');
					}
				}
				
				
				_2ndCert = _2ndCert.replaceAll('#{CONFIRM}', jexML.get("nxisas_v2_j035", "Confirm"));
				_2ndCert = _2ndCert.replaceAll('#{CANCEL}', jexML.get("nxisas_v2_j011", "Cancel"));
				
				
				if(typeof(trns_0001) != "undefined"){
					trns_0001.closeProgressBar();
				} 
				
				if (null != sind) {
					_v2nxisas._2ndCertList[sind] = _2ndCert;
					_v2nxisas.open2ndCertPop(sind, true);
				} else {
					_v2nxisas._2ndCertList.push(_2ndCert);
				}				
				
			}else {
				// console.log("CAPTCHA", obj.CallBackfunc)
				// console.log("BANK_INFO", _v2nxisas.orgObj[ind].bankCd)
				// console.log("BANK_INFO", _v2nxisas.orgObj[ind].bankNm)
				
				_2ndCert = _2ndCert.replaceAll('#{THREAD_INDEX}', ''+ind);
				if (null != sind) {
					_2ndCert = _2ndCert.replaceAll('#{2NDCERT_INDEX}', ''+sind);
				} else {
					_2ndCert = _2ndCert.replaceAll('#{2NDCERT_INDEX}', ''+_v2nxisas._2ndCertList.length);
				}
				if ('VIETNAM_GDT' == _v2nxisas.orgObj[ind].bankCd) {
					_2ndCert = _2ndCert.replaceAll('#{BANK_INFO}', jexML.get("nxisas_v2_j041","GDT(General Department of Taxation)"));
					_v2nxisas._GDTCaptchaTryCount++;
				} else {
					_2ndCert = _2ndCert.replaceAll('#{BANK_INFO}', ''+_v2nxisas.orgObj[ind].bankNm);
					_2ndCert = _2ndCert.replaceAll('#{BANK_LOGID}', ''+_v2nxisas.orgObj[ind].loginID);	
				}
				if ('CAPTCHA' == obj.CallBackfunc) {
					if ('VIETNAM_GDT' == _v2nxisas.orgObj[ind].bankCd) {
						_2ndCert = _2ndCert.replaceAll('#{IMG_FORMAT}', 'svg+xml');
					} else {
						_2ndCert = _2ndCert.replaceAll('#{IMG_FORMAT}', 'png');	
					}
					_2ndCert = _2ndCert.replaceAll('#{IMG}', ''+obj.req.req);		
					_2ndCert = _2ndCert.replaceAll('#{CAPTCHA_INPUT}', jexML.get("nxisas_v2_j040","Enter CAPTCHA"));	
				}
				
				if ('QNA' == obj.CallBackfunc) {
					var _option = '';

					$.each(obj.req.req, function(ind, obj) {
						_option += '<li data-val="' + obj.Question + '" data-hiddenVal="' + obj.HiddenValue + '">' + obj.Question + '</li>';
					});
					
					_2ndCert = _2ndCert.replaceAll('#{Question}', jexML.get("nxisas_api_j007", "Question"));
					_2ndCert = _2ndCert.replaceAll('#{Answer}', jexML.get("nxisas_api_j008", "Answer"));
					_2ndCert = _2ndCert.replaceAll('#{ml_bank_logid}',   jexML.get("nxisas_api_j009", "Login ID"));
					
					_2ndCert = _2ndCert.replaceAll('#{Question_Placeholder}', jexML.get("nxisas_api_j001", "Select the question."));
					_2ndCert = _2ndCert.replaceAll('#{Security_Question}', jexML.get("nxisas_api_j006", "Security Question"));
					
					_2ndCert = _2ndCert.replaceAll('#{Answer_Placeholder}', jexML.get("nxisas_api_j002", "Enter the answer"));
					_2ndCert = _2ndCert.replaceAll('#{QNA_LIST}', _option);
				}
				
				if ('OTP' == obj.CallBackfunc && typeof(obj.req.transfer) == 'undefinecd') {
					var _option = '';
					$.each(obj.req.req, function(ind, obj) {
						if (typeof(obj.Title) != 'undefined') {
							_option += obj.Title + '';	
						}
						if (typeof(obj.Code) != 'undefined') {
							_option += '(' + obj.Code + ')';	
						}
					});
					_2ndCert = _2ndCert.replaceAll('#{ADDITIONAL_INFO}', ' ' + _option);
				} else {
					_2ndCert = _2ndCert.replaceAll('#{ADDITIONAL_INFO}', '');
				}			
				
				
				if ('CAPTCHA' == obj.CallBackfunc ||  'OTP' == obj.CallBackfunc)   {
					_2ndCert = _2ndCert.replaceAll('#{CONFIRM}', jexML.get("nxisas_v2_j036", "OK"));
				}else{
					_2ndCert = _2ndCert.replaceAll('#{CONFIRM}', jexML.get("nxisas_v2_j035", "Confirm"));
				}
				
				_2ndCert = _2ndCert.replaceAll('#{CANCEL}', jexML.get("nxisas_v2_j011", "Cancel"));
				
				if(typeof(trns_0001) != "undefined"){
					trns_0001.closeProgressBar();
				} 
				
				if (null != sind) {
					_v2nxisas._2ndCertList[sind] = _2ndCert;
					_v2nxisas.open2ndCertPop(sind, true);
				} else {
					_v2nxisas._2ndCertList.push(_2ndCert);
	//				if (_v2nxisas.ThreadLength - _v2nxisas._loginFinishCount == _v2nxisas._2ndCertList.length) {		// 2차인증 대상 데이터가 모두 적재되었으면(=전체 Thread 갯수 - 로그인 완료 갯수로 판단) 2차인증 시작. 
	//					_v2nxisas.open2ndCertPop(0);
	//				}
				}				
			}
		}
	},
	
	open2ndCertPop : function(ind, retry) {
		_v2nxisas._2ndCertProcessing = true;
		if (null == ind) {
			ind = 0;
		}
		if (null == retry) {
			retry = false;
		}
		
		if (_v2nxisas._2ndCertList.length > 0 && _v2nxisas._2ndCertList.length >= ind+1) {
			var _popup = $(_v2nxisas._2ndCertList[ind]);
			var _popupName = _v2common.app.getPopupName(_popup);
			_popup.attr('fromPopup', _popupName);
			$('body').append(_popup);
			//if (retry || null == _v2nxisas._2ndCertIndex) {
				//_v2nxisas._2ndCertIndex = ind;
				top.tmsComm.destroyProgressBar();
				_v2common.app.enableLayerPopup(_popupName, function() {
					if ('otp' == _popupName || 'captcha' == _popupName)
						$("."+_popupName+" input[name='res']").focus();
				});	
			//}
		}
	},
	
	make2ndCertInput : function(ind, obj) {
		if (_v2nxisas.loadedNxisas && null != _v2nxisas.orgObj) {
			var orgObj = _v2nxisas.orgObj[ind];
			var _header = _v2nxisas.makeHeader(orgObj.bankCd, (!jexjs.empty(orgObj.nxisasGbSeqNo) ? orgObj.nxisasGbSeqNo : '0'), obj.CallBackfunc);
			var _input = {"res" : ""};
			if (typeof(obj.req.req) != 'undefined' && typeof(obj.req.req[0].Title) != 'undefined') {
				_input.Title = obj.req.req[ind].Title;
			}
			if (typeof(obj.req.req) != 'undefined' && typeof(obj.req.req[0].Code) != 'undefined') {
				_input.Code = obj.req.req[ind].Code;
			}			
			_header.Input = _input;
			_v2nxisas.nxisasObj[ind].push(_header);
		}
	},
	
	getCertInfo : function (seq) {
		//top.tmsComm.createProgressBar();
		var jexAjax = jexjs.createAjaxUtil("nxisas_acctList_r003");
		var input = {};
		var _dataObj = null;
		input.SEQ_NO = seq;
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(input);
		jexAjax.setting('async', false);
		jexAjax.execute(function (rData) {
			if (jexjs.isJexError(rData)) {
				top.tmsComm.destroyProgressBar();
				_v2common.app.showMessage(rData);
				return;
			}
			
			_dataObj = rData;
			//top.tmsComm.destroyProgressBar();
		});			
		return _dataObj;
	},	
	// Read GDT Information 
	// NOTE: Now it has only one row for GDT login so Biz_key is a primary key(Don't need seq_no)
	getGDTCertInfo : function () {
		//top.tmsComm.createProgressBar();
		var jexAjax = jexjs.createAjaxUtil("gdtc_0001_001_r001");
		var input = {};
		var _dataObj = null;
		//input.SEQ_NO = seq;
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(input);
		jexAjax.setting('async', false);
		jexAjax.execute(function (rData) {
			if (jexjs.isJexError(rData)) {
				top.tmsComm.destroyProgressBar();
				_v2common.app.showMessage(rData);
				return;
			}
			
			_dataObj = rData;
			//top.tmsComm.destroyProgressBar();
		});			
		return _dataObj;
	},	
	
	/* Decrypt to NXISAS Encrypted Data */
	nxisas_decrypt : function(res){
		var _rtn = {};
		var jexAjax = jexjs.createAjaxUtil("nxisas_decrypt");
		var _input = {};
		_input['NXISAS_DATA'] = JSON.stringify(res);
		_input['NXISAS_UID'] = CooconiSASNX.OpenUid;
		_input['NXISAS_ACTION'] = CooconiSASNX.OpenAction;		
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(_input);
		jexAjax.setting('async', false);
		jexAjax.execute(function (rData) {
			if (jexjs.isJexError(rData)) {
				_v2common.app.showMessage(rData);
				return;
			}
			
			_rtn = JSON.parse(rData.NXISAS_DATA);
		});			
		
		return _rtn;		
	},
	
	   callNxisas : function(obj, progress, callback, unit_callback, job_callback) {
		
			_v2nxisas._nxsasLogInd =0;
			_v2nxisas._nxsasResInd =0;

		if (_v2nxisas.loadedNxisas) {
			if (_v2nxisas.progress) {
				top.tmsComm.createProgressBar();	
			}
			_v2nxisas._finishedCount = 0;
			//_v2nxisas._2ndCertIndex = null;		
			_v2nxisas.orgObj = obj;
			_v2nxisas.nxisasObj = null;
			_v2nxisas._2ndCertList = [];
			_v2nxisas.ThreadLength = 0;
			if (null != callback) {
				_v2nxisas.callback = callback;	
			}
			if (null != unit_callback) {
				_v2nxisas.unit_callback = unit_callback;
			}
			if (null != job_callback) {
				_v2nxisas.job_callback = job_callback;
			}			
			
			_v2nxisas.progress = progress;
			
			_v2nxisas._loginFinishCount = 0;
			_v2nxisas._2ndCertProcessing = false;
			
			_v2nxisas._GDTCaptchaTryCount = 0;
	
			_v2nxisas._2ndCertProcessingNonLogin = false;
			_v2nxisas._2ndCertFinishCount = 0;			
			
			var ThreadLength = _v2nxisas.orgObj.length;
			_v2nxisas.ThreadLength = ThreadLength;			
			
			var openThreadLength = 0;
			if (typeof(_v2nxisas.orgObj[0].threadCount) != 'undefined') {
				openThreadLength = _v2nxisas.orgObj[0].threadCount;
			} else {
				openThreadLength = _v2nxisas.ThreadLength;
			}			

			
			_v2nxisas.makeLoginInput(null, false, function() {
				console.log('------------------------- orgObj -------------------------');
				console.log(_v2nxisas.orgObj);
				console.log('------------------------- orgObj -------------------------');
				console.log('------------------------- nxisasObj -------------------------');
				console.log(_v2nxisas.nxisasObj);
				console.log('------------------------- nxisasObj -------------------------');
				
				/**
				* Scraping Start
				*/res = {
							"Msg": "Open",
							"ErrorCode": "00000000",
							"ErrorMessage": ""
						};
				//CooconiSASNX.open(openThreadLength , function (res){
					
					if(res.ErrorCode == "00000000" ){//Open success		
						// 각 스레드별로 가동
						for(var ThreadIndex = 0; ThreadIndex < ThreadLength ; ThreadIndex++){
							if (typeof(_v2nxisas.orgObj[ThreadIndex].nonLogin) == 'undefined' || !_v2nxisas.orgObj[ThreadIndex].nonLogin) {
								// 이미 결과 오브젝트가 있는 Thread(사용자가 로그인 암호를 입력하지 않고 취소하였을 경우)는 실행하지 않음.
								if (null == _v2nxisas.orgObj[ThreadIndex].result) {
									// 가동시작. 로그인시도함.
									 _v2nxisas.execute(_v2nxisas.nxisasObj[ThreadIndex], ThreadIndex, function(res, seq) {
										_v2nxisas.run_afterLoginSuccess(res, seq);
									}, function(res, seq) {
										_v2nxisas.run_afterLoginFail(res, seq);					
									});		
								}											
							} else {
								// 비로그인 거래시에는 성공으로 간주하고 거래진행.
								_v2nxisas.run_afterLoginSuccess(res, ThreadIndex);								
							}						
						}				
					}
				//});				
			});
		}
	},
	
	// 기존 NXISAS 프로세스가 오픈된 상황에서 사용하는 함수(스크래핑을 한 번에 2회 이상 호출해야 할 경우 사용.)
	callNxisasWithoutOpenProcess : function(obj, progress, callback, unit_callback, job_callback) {
		if (_v2nxisas.loadedNxisas) {
			if (_v2nxisas.progress) {
				top.tmsComm.createProgressBar();	
			}
			_v2nxisas._finishedCount = 0;
			//_v2nxisas._2ndCertIndex = null;		
			_v2nxisas.orgObj = obj;
			_v2nxisas.nxisasObj = null;
			_v2nxisas._2ndCertList = [];
			_v2nxisas.ThreadLength = 0;
			if (null != callback) {
				_v2nxisas.callback = callback;	
			}
			if (null != unit_callback) {
				_v2nxisas.unit_callback = unit_callback;
			}
			if (null != job_callback) {
				_v2nxisas.job_callback = job_callback;
			}			
			
			_v2nxisas.progress = progress;
			
			_v2nxisas._loginFinishCount = 0;
			_v2nxisas._2ndCertProcessing = false;
			
			_v2nxisas._2ndCertProcessingNonLogin = false;
			_v2nxisas._2ndCertFinishCount = 0;						 					 				
			
			var ThreadLength = _v2nxisas.orgObj.length;
			_v2nxisas.ThreadLength = ThreadLength;			
			
			_v2nxisas.makeLoginInput(null, false, function() {
				console.log('------------------------- orgObj -------------------------');
				console.log(_v2nxisas.orgObj);
				console.log('------------------------- orgObj -------------------------');
				console.log('------------------------- nxisasObj -------------------------');
				console.log(_v2nxisas.nxisasObj);
				console.log('------------------------- nxisasObj -------------------------');
				
				/**
				* Scraping Start
				*/
				// 각 스레드별로 가동
				for(var ThreadIndex = 0; ThreadIndex < ThreadLength ; ThreadIndex++){
					if (typeof(_v2nxisas.orgObj[ThreadIndex].nonLogin) == 'undefined' || !_v2nxisas.orgObj[ThreadIndex].nonLogin) {
						// 이미 결과 오브젝트가 있는 Thread(사용자가 로그인 암호를 입력하지 않고 취소하였을 경우)는 실행하지 않음.
						if (null == _v2nxisas.orgObj[ThreadIndex].result) {
							// 가동시작. 로그인시도함.
							_v2nxisas.execute(_v2nxisas.nxisasObj[ThreadIndex], ThreadIndex, function(res, seq) {
								_v2nxisas.run_afterLoginSuccess(res, seq);
							}, function(res, seq) {
								_v2nxisas.run_afterLoginFail(res, seq);					
							});		
						}											
					} else {
						// 비로그인 거래시에는 성공으로 간주하고 거래진행.
						_v2nxisas.run_afterLoginSuccess({}, ThreadIndex);								
					}						
				}							
			});
		}
	},
	
	// 기존 NXISAS 프로세스가 오픈된 상황에서 사용하는  병렬처리용 함수(같은 기관의 거래를 비연속적으로  병렬로 실행시켜야 할 경우 사용.)
	callNxisasParallel : function(obj, progress, callback, unit_callback, job_callback) {
		if (_v2nxisas.loadedNxisas) {
			if (_v2nxisas.progress) {
				top.tmsComm.createProgressBar();	
			}
			_v2nxisas._finishedCount = 0;
			//_v2nxisas._2ndCertIndex = null;		
			_v2nxisas.orgObj = obj;
			_v2nxisas.nxisasObj = null;
			_v2nxisas._2ndCertList = [];
			_v2nxisas.ThreadLength = 0;
			if (null != callback) {
				_v2nxisas.callback = callback;	
			}
			if (null != unit_callback) {
				_v2nxisas.unit_callback = unit_callback;
			}
			if (null != job_callback) {
				_v2nxisas.job_callback = job_callback;
			}			
			
			_v2nxisas.progress = progress;
			
			_v2nxisas._loginFinishCount = 0;
			_v2nxisas._2ndCertProcessing = false;
			
			_v2nxisas._2ndCertProcessingNonLogin = false;
			_v2nxisas._2ndCertFinishCount = 0;						
			
			// 기관에 따라(= orgObj의 갯수에 따라) 쓰레드 갯수 구성. 기관별로 실행해야 할 Job의 갯수가 5개 이상이면 병렬로 구성시키고, 그렇지 않으면 기존대로 1개의 쓰레드로 실행시키도록 처리.
			var ThreadLength = 0;
			for (var i=0; i<_v2nxisas.orgObj.length; i++) {
				var jobLength = _v2nxisas.orgObj[i].job.length;
				ThreadLength += (jobLength > 5 ? Math.ceil(jobLength / 5) : 1);
				//ThreadLength += (jobLength > 10 ? Math.ceil(jobLength / 10) : 1);
			}
			
			_v2nxisas.ThreadLength = ThreadLength;			
			
			_v2nxisas.makeLoginInput(null, false, function() {
				console.log('------------------------- orgObj -------------------------');
				console.log(_v2nxisas.orgObj);
				console.log('------------------------- orgObj -------------------------');
				console.log('------------------------- nxisasObj -------------------------');
				console.log(_v2nxisas.nxisasObj);
				console.log('------------------------- nxisasObj -------------------------');
				
				var _parallelArray_orgObj = [];
				var _threadArray_orgObj = [];				
				for (var i=0; i<_v2nxisas.orgObj.length; i++) {
					var _threadObj = _v2nxisas.orgObj[i].job;
					for (var j=0; j<_threadObj.length; j++) {
						_threadObj[j].bankCd = _v2nxisas.orgObj[i].bankCd;
						_threadObj[j].nonDecrypt = _v2nxisas.orgObj[i].nonDecrypt;
						_threadObj[j].nonLogin = _v2nxisas.orgObj[i].nonLogin;
						_threadObj[j].nonLogout = _v2nxisas.orgObj[i].nonLogout;
						_threadArray_orgObj.push(_threadObj[j]);
						
						if (_threadArray_orgObj.length == 5) {
						//if (_threadArray_orgObj.length == 10) {
							_parallelArray_orgObj.push(_threadArray_orgObj);
							_threadArray_orgObj = [];
						} else if (j == _threadObj.length-1) {
							_parallelArray_orgObj.push(_threadArray_orgObj);
						}
					}
				}
				
				console.log("_v2nxisas.ThreadLength :::: " + _v2nxisas.ThreadLength);
				console.log(" ::::: _parallelArray ::::: ");
				console.log(_parallelArray_orgObj);
				console.log(" ::::: _parallelArray ::::: ");
				
				_v2nxisas.orgObj = _parallelArray_orgObj;
				
				/**
				* 모듈 재오픈(병렬 처리 시에는 스레드 갯수가 늘어나므로 그만큼 오픈을 해줘야함.)
				*/
				CooconiSASNX.open(_v2nxisas.ThreadLength , function (res){			
					if(res.ErrorCode == "00000000" ){//Open 성공
						CooconiSASNX.sendMsg("SharedSession");
						
						// 각 스레드별로 가동
						for(var ThreadIndex = 0; ThreadIndex < ThreadLength ; ThreadIndex++){
							if (typeof(_v2nxisas.orgObj[ThreadIndex][0].nonLogin) == 'undefined' || !_v2nxisas.orgObj[ThreadIndex][0].nonLogin) {
								// 이미 결과 오브젝트가 있는 Thread(사용자가 로그인 암호를 입력하지 않고 취소하였을 경우)는 실행하지 않음.
								if (null == _v2nxisas.orgObj[ThreadIndex][0].result) {
									// 가동시작. 로그인시도함.
									_v2nxisas.execute(_v2nxisas.nxisasObj[ThreadIndex], ThreadIndex, function(res, seq) {
										_v2nxisas.run_afterLoginSuccess(res, seq);
									}, function(res, seq) {
										_v2nxisas.run_afterLoginFail(res, seq);					
									});		
								}											
							} else {
								// 비로그인 거래시에는 성공으로 간주하고 거래진행.
								_v2nxisas.run_afterLoginSuccess({}, ThreadIndex);								
							}						
						}							
					}
				});										
			});``
		}
	},		
	
	run_afterLoginFail : function(res, seq, _2ndCertIndex) {
		// Fail
		_v2nxisas._finishedCount++;
		_v2nxisas._loginFinishCount++;
		if (_v2nxisas._2ndCertProcessingNonLogin) {
			_v2nxisas._2ndCertFinishCount++;
		}
		
		//if (seq == _v2nxisas.ThreadLength - 1) {																		// 마지막 Thread인 경우에만 2차인증 시작판단.
			console.log('------------------ Thread (' + seq + ') ------------------');
			console.log('_v2nxisas.ThreadLength : ' + _v2nxisas.ThreadLength);
			console.log('_v2nxisas._loginFinishCount : ' + _v2nxisas._loginFinishCount);
			console.log('_v2nxisas._2ndCertList.length : ' + _v2nxisas._2ndCertList.length);
			console.log('----------------------------------------------------------');
			if (null != _2ndCertIndex) {
				_v2nxisas.open2ndCertPop(++_2ndCertIndex);
			} else {
				if (!_v2nxisas._2ndCertProcessing) {
					if (_v2nxisas.ThreadLength - _v2nxisas._loginFinishCount == _v2nxisas._2ndCertList.length) {		// 2차인증 대상 데이터가 모두 적재되었으면(=전체 Thread 갯수 - 로그인 완료 갯수로 판단) 2차인증 시작. 
						_v2nxisas.open2ndCertPop(0);
					}
				}				
			}
		//}		
		
		_v2nxisas.orgObj[seq].result = res;
		
		if (_v2nxisas._finishedCount <= _v2nxisas.ThreadLength) {
			if (null != _v2nxisas.unit_callback && typeof(_v2nxisas.unit_callback) == 'function') {
				_v2nxisas.unit_callback(_v2nxisas.orgObj[seq]);
			}
		}							
		if (_v2nxisas._finishedCount == _v2nxisas.ThreadLength) {
			top.tmsComm.destroyProgressBar();
			_v2nxisas.logging();
			if (null != _v2nxisas.callback && typeof(_v2nxisas.callback) == 'function') {
				_v2nxisas.callback(_v2nxisas.orgObj);
			}								
		}		
	},
	
	// 참고 : 2차인증 실패로 인한 재로그인인 경우는 sind(2차인증 Index)가 들어옴.
	run_afterLoginSuccess : function(res, seq, sind) {
		// Success
		//console.log('sind : ' + sind);
		if (typeof(res[0]) != 'undefined' && null != res[0].Output.Result.CallBackfunc) {
			_v2nxisas.nxisasObj[seq] = [];
			if (null != sind) {
				_v2nxisas.run2ndCert(seq, res[0].Output.Result, sind);
			} else {
				_v2nxisas.run2ndCert(seq, res[0].Output.Result);
				
				//if (seq == _v2nxisas.ThreadLength - 1) {																		// 마지막 Thread인 경우에만 2차인증 시작판단.
				console.log('------------------ Thread (' + seq + ') ------------------');
				console.log('_v2nxisas.ThreadLength : ' + _v2nxisas.ThreadLength);
				console.log('_v2nxisas._loginFinishCount : ' + _v2nxisas._loginFinishCount);
				console.log('_v2nxisas._2ndCertList.length : ' + _v2nxisas._2ndCertList.length);
				console.log('_v2nxisas._2ndCertProcessing : ' + _v2nxisas._2ndCertProcessing);
				console.log('----------------------------------------------------------');
					if (!_v2nxisas._2ndCertProcessing) {
						if (_v2nxisas.ThreadLength - _v2nxisas._loginFinishCount == _v2nxisas._2ndCertList.length || _v2nxisas.ThreadLength - _v2nxisas._2ndCertFinishCount == _v2nxisas._2ndCertList.length) {		// 2차인증 대상 데이터가 모두 적재되었으면(=전체 Thread 갯수 - 로그인 완료 갯수로 판단) 2차인증 시작. 
							_v2nxisas.open2ndCertPop(0);
						}
					}
				//}				
			}			
		} else {
			if (_v2nxisas._loginFinishCount <_v2nxisas.ThreadLength) {
				_v2nxisas._loginFinishCount++;
			}
			if (_v2nxisas._2ndCertProcessingNonLogin) {
				if (_v2nxisas._2ndCertFinishCount <_v2nxisas.ThreadLength) {
					_v2nxisas._2ndCertFinishCount++;
				}							
				seq++;
			}
			
			//https://flow.team/l/PS4Pt
			//Commment below code because above issue. For KEBHana Bank, it remove progressbar before transaction complete
			/*if (_v2nxisas._loginFinishCount == _v2nxisas.ThreadLength) {
				top.tmsComm.destroyProgressBar();
			}*/			
			
			if (seq < _v2nxisas.orgObj.length) {
				if (Array.isArray(_v2nxisas.orgObj[seq])) {
					_v2nxisas.nxisasObj[seq] = [];
					//if ((typeof(_v2nxisas.orgObj[seq].job) != 'undefined' && null != _v2nxisas.orgObj[seq].job && _v2nxisas.orgObj[seq].job.length > 0) || (typeof(_v2nxisas.orgObj[seq][0].Job) != 'undefined' && null != _v2nxisas.orgObj[seq][0].Job && _v2nxisas.orgObj[seq][0].Job.length > 0)) {
					for (var i=0; i<_v2nxisas.orgObj[seq].length; i++) {
						if (null != _v2nxisas.orgObj[seq][i].Job && _v2nxisas.orgObj[seq][i].Job.length > 0) {
							var _parallelObj = _v2nxisas.makeHeader(_v2nxisas.orgObj[seq][i].bankCd, (!jexjs.empty(_v2nxisas.orgObj[seq][i].nxisasGbSeqNo) ? _v2nxisas.orgObj[seq][i].nxisasGbSeqNo : '0'), _v2nxisas.orgObj[seq][i].Job);
							_parallelObj.Input = _v2nxisas.orgObj[seq][i].Input;
							_v2nxisas.nxisasObj[seq].push(_parallelObj);
						}					
					}				
				} else {
					_v2nxisas.nxisasObj[seq] = [];
					//if ((typeof(_v2nxisas.orgObj[seq].job) != 'undefined' && null != _v2nxisas.orgObj[seq].job && _v2nxisas.orgObj[seq].job.length > 0) || (typeof(_v2nxisas.orgObj[seq][0].Job) != 'undefined' && null != _v2nxisas.orgObj[seq][0].Job && _v2nxisas.orgObj[seq][0].Job.length > 0)) {
					if (null != _v2nxisas.orgObj[seq].job && _v2nxisas.orgObj[seq].job.length > 0) {
						_v2nxisas.makeJobInput(seq);
					}
					_v2nxisas.makeLogOutInput(seq);				
				}
				
				// job에 입력한 거래들 시도 후 로그아웃.
				_v2nxisas.execute(_v2nxisas.nxisasObj[seq], seq, function(res2, seq2) {
					
					// console.log("res2 >>>> " , res2)
					// console.log("seq2 >>>> " , seq2)
					
					if (typeof(res2[0]) != 'undefined' && null != res2[0].Output.Result.CallBackfunc) {
						_v2nxisas._2ndCertProcessingNonLogin = true;
						_v2nxisas.run_afterLoginSuccess(res2, seq2, sind);
					} else {
						// Success
						_v2nxisas._finishedCount++;
						
						// console.log("seq2 AAAA>>>> " , seq2)
						// console.log("_v2nxisas.orgObj[seq2] >>>> " , _v2nxisas.orgObj[seq2])

						if (
							_v2nxisas.orgObj[seq2] &&
							seq2 < _v2nxisas.orgObj.length &&
							Array.isArray(_v2nxisas.orgObj[seq2].job) &&
							_v2nxisas.orgObj[seq2].job.length > 0
						) {
							// Logout 정보는 보내지 않기. 단, Job List가 없는 경우(로그인만 하는 경우)에는 LOGOUT 정보를 보냄.
							res2 = res2.filter(function (item) {
								return item.Job !== 'LOGOUT';
							});
						}
						
						if (Array.isArray(_v2nxisas.orgObj[seq])) {
							for (var i=0; i<_v2nxisas.orgObj[seq].length; i++) {
								_v2nxisas.orgObj[seq][i].result = res2[i];	
							}
						} else {
							_v2nxisas.orgObj[seq2].result = res2;		
						}
						
						//if (null == sind && seq == _v2nxisas.ThreadLength - 1) {															// 2차인증 실패 재로그인이 아니고 마지막 Thread인 경우에만 2차인증 시작판단. (어차피 2차인증 실패일때는 2ndcertProcessing이 true이겠지만...)
						console.log('------------------ Thread (' + seq + ') ------------------');
						console.log('_v2nxisas.ThreadLength : ' + _v2nxisas.ThreadLength);
						console.log('_v2nxisas._loginFinishCount : ' + _v2nxisas._loginFinishCount);
						console.log('_v2nxisas._2ndCertList.length : ' + _v2nxisas._2ndCertList.length);
						console.log('----------------------------------------------------------');
						if (!_v2nxisas._2ndCertProcessing) {
							if (_v2nxisas.ThreadLength - _v2nxisas._loginFinishCount == _v2nxisas._2ndCertList.length) {		// 2차인증 대상 데이터가 모두 적재되었으면(=전체 Thread 갯수 - 로그인 완료 갯수로 판단) 2차인증 시작. 
								_v2nxisas.open2ndCertPop(0);
							}
						}
					//}				
						
						if (_v2nxisas._finishedCount <= _v2nxisas.ThreadLength) {
							if (null != _v2nxisas.unit_callback && typeof(_v2nxisas.unit_callback) == 'function') {
								_v2nxisas.unit_callback(_v2nxisas.orgObj[seq2]);
							}
						}							
						if (_v2nxisas._finishedCount == _v2nxisas.ThreadLength) {
							top.tmsComm.destroyProgressBar();
							_v2nxisas.logging();
							if (null != _v2nxisas.callback && typeof(_v2nxisas.callback) == 'function') {
								_v2nxisas.callback(_v2nxisas.orgObj);
							}								
						}									
					}									
				}, function(res2, seq2) {
					// Fail
					_v2nxisas._finishedCount++;

					if (
						_v2nxisas.orgObj[seq2] &&
						seq2 < _v2nxisas.orgObj.length &&
						Array.isArray(_v2nxisas.orgObj[seq2].job) &&
						_v2nxisas.orgObj[seq2].job.length > 0
					) {
						// Logout 정보는 보내지 않기. 단, Job List가 없는 경우(로그인만 하는 경우)에는 LOGOUT 정보를 보냄.
						res2 = res2.filter(function (item) {
							return item.Job !== 'LOGOUT';
						});
					}
					
					_v2nxisas.orgObj[seq2].result = res2;
					
					//if (null == sind && seq == _v2nxisas.ThreadLength - 1) {															// 2차인증 실패 재로그인이 아니고 마지막 Thread인 경우에만 2차인증 시작판단. (어차피 2차인증 실패일때는 2ndcertProcessing이 true이겠지만...)
					console.log('------------------ Thread (' + seq + ') ------------------');
					console.log('_v2nxisas.ThreadLength : ' + _v2nxisas.ThreadLength);
					console.log('_v2nxisas._loginFinishCount : ' + _v2nxisas._loginFinishCount);
					console.log('_v2nxisas._2ndCertList.length : ' + _v2nxisas._2ndCertList.length);
					console.log('----------------------------------------------------------');
					if (!_v2nxisas._2ndCertProcessing) {
						if (_v2nxisas.ThreadLength - _v2nxisas._loginFinishCount == _v2nxisas._2ndCertList.length) {		// 2차인증 대상 데이터가 모두 적재되었으면(=전체 Thread 갯수 - 로그인 완료 갯수로 판단) 2차인증 시작. 
							_v2nxisas.open2ndCertPop(0);
						}
					}
				//}				
					
					if (_v2nxisas._finishedCount <= _v2nxisas.ThreadLength) {
						if (null != _v2nxisas.unit_callback && typeof(_v2nxisas.unit_callback) == 'function') {
							_v2nxisas.unit_callback(_v2nxisas.orgObj[seq2]);
						}
					}
										
					if (_v2nxisas._finishedCount == _v2nxisas.ThreadLength) {
						top.tmsComm.destroyProgressBar();
						_v2nxisas.logging();
						if (null != _v2nxisas.callback && typeof(_v2nxisas.callback) == 'function') {
							_v2nxisas.callback(_v2nxisas.orgObj);
						}								
					}						
				},res[0].Common,res[0].SAS_SessionID);					
			} else {
				_v2nxisas.orgObj[seq-1].result = res;
				
				// Success
				_v2nxisas._finishedCount++;				
				if (_v2nxisas._finishedCount <= _v2nxisas.ThreadLength) {
					if (null != _v2nxisas.unit_callback && typeof(_v2nxisas.unit_callback) == 'function') {
						_v2nxisas.unit_callback(_v2nxisas.orgObj[seq]);
					}
				}							
				if (_v2nxisas._finishedCount == _v2nxisas.ThreadLength) {
					top.tmsComm.destroyProgressBar();
					_v2nxisas.logging();
					if (null != _v2nxisas.callback && typeof(_v2nxisas.callback) == 'function') {
						_v2nxisas.callback(_v2nxisas.orgObj);
					}								
				}										
			}
		}
	},	
	
	updateCertInfo : function (input, skipalert) {
		if (null == skipalert) skipalert = false;
		
		top.tmsComm.createProgressBar();
		var jexAjax = jexjs.createAjaxUtil("fnif_0001_003_u001");
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(input);
		jexAjax.setting('async', false);
	    jexAjax.execute({
	        success: function (cData) {
				if (jexjs.isJexError(cData)) {
					top.tmsComm.destroyProgressBar();
					if (!skipalert) {
						_v2common.app.showMessage(cData);
					}
					return;
				}					        	
	            top.tmsComm.destroyProgressBar();
	            //close_smartPop('create_calllback');
	            if (!skipalert) {
		            _v2common.app.showMessage('WBI6002', function() {
			            _v2common.app.closeLayerPopup(function() {
							if (typeof(fnsh_0001_001) != 'undefined') {
								fnsh_0001_001.nxisas_acctList_callbackLoad(true);
							} else if (typeof(fnsh_0005_001) != 'undefined') {
								fnsh_0005_001.nxisas_acctList_callbackLoad(true);
							} else if (typeof(fnif_0002_001) != 'undefined') {
								fnif_0002_001.fn_loadDataFrmDB();
							}
			            });					            	
		            });	            	
	            }
	        },
	        error: function (cData) {
	        	top.tmsComm.destroyProgressBar();
	        	if (!skipalert) {
	        		_v2common.app.showMessage(cData);	        		
	        	}
	        }
	    });				
	},
	// update GDT Information
	updateGDTCertInfo : function (input, skipalert) {
		if (null == skipalert) skipalert = false;
		
		top.tmsComm.createProgressBar();
		var jexAjax = jexjs.createAjaxUtil("gdtc_0001_002_u001");
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(input);
		jexAjax.setting('async', false);
	    jexAjax.execute({
	        success: function (cData) {
				if (jexjs.isJexError(cData)) {
					top.tmsComm.destroyProgressBar();
					if (!skipalert) {
						_v2common.app.showMessage(cData);
					}
					return;
				}					        	
	            top.tmsComm.destroyProgressBar();
	            //close_smartPop('create_calllback');
	            if (!skipalert) {
		            _v2common.app.showMessage('WBI6002', function() {
			            _v2common.app.closeLayerPopup(function() {
			            	einv_0001_001.load();
			            });					            	
		            });	            	
	            }
	        },
	        error: function (cData) {
	        	top.tmsComm.destroyProgressBar();
	        	if (!skipalert) {
	        		_v2common.app.showMessage(cData);	        		
	        	}
	        }
	    });				
	},
	
	logging : function() {
		var jexAjax = jexjs.createAjaxUtil("nxisas_logging");
		var _input = {};
		_input['JSON_STR'] = JSON.stringify(_v2nxisas.orgObj);		
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(_input);
		jexAjax.setting('async', false);
		jexAjax.execute(function (rData) {});					
	},
	
	execute : function(
		input,
		thread,
		callback_suc,
		callback_fail,
		common= null,
		sas_sessionId= null
	) {
		
		_v2nxisas.getNxsasResult(
			input,
			thread,
			function (res, seq){

			//CooconiSASNX.execute(input, thread , function (res, seq){

				console.log('----------------execute-- thread('+thread+') input ------input--------------');
				console.log(input);
				console.log('-----------------------------------------------------------------------------');

				/**
				* Insert log and Decrypt data
				*/
			/*	if (( !Array.isArray(_v2nxisas.orgObj[thread]) && typeof(_v2nxisas.orgObj[thread].nonDecrypt) == 'undefined' ) || ( !Array.isArray(_v2nxisas.orgObj[thread]) && !_v2nxisas.orgObj[thread].nonDecrypt ) || ( Array.isArray(_v2nxisas.orgObj[thread]) && typeof(_v2nxisas.orgObj[thread][0].nonDecrypt) == 'undefined' ) || ( Array.isArray(_v2nxisas.orgObj[thread]) && !_v2nxisas.orgObj[thread][0].nonDecrypt ) || 'LOGIN' == res[0].Job || 'CAPTCHA' == res[0].Job || 'OTP' == res[0].Job || 'QNA' == res[0].Job || 'LOGOUT' == res[0].Job) {
					res = _v2nxisas.nxisas_decrypt( res );
				}*/

				console.log('----------------execute-- thread('+thread+') output ------res----------------');
				console.log(res);
				console.log('-----------------------------------------------------------------------------');

				if (res[0].Output.ErrorCode == '00000000') {
					if (typeof(callback_suc) == 'function') {
						callback_suc(res, seq);
					}
				} else {
					if (typeof(callback_fail) == 'function') {
						callback_fail(res, seq);
					}
				}
			},
			common || null,
			sas_sessionId || null,
			_v2nxisas.orgObj[thread].nxisasGbSeqNo || 0
		);
	},

	getNxsasResult: function(input, thread, callBack, common, sas_id, nxisasGbSeqNo = 0){
		newListInput = [];

		$.each(input, function (key, value) {
			const newInput = {
				Module: value.Module,
				Class: value.Class,
				Job: value.Job,
				ErrorLang: value.ErrorLang,
				countryCode: value.Input?.countryCode || null
			};

			switch (value.Job) {
				case "LOGIN":
					newInput.loginType = value.Input.loginType;
					newInput.loginID = value.Input.loginID;
					newInput.loginPWD = value.Input.loginPWD;
					if (value.Input.loginPWD1) newInput.loginPWD1 = value.Input.loginPWD1;
					if (value.Input.corporateID) newInput.corporateID = value.Input.corporateID;
					break;

				case "CAPTCHA":
				case "OTP":
					newInput.res = value.Input.res;
					break;

				case "QNA":
					newInput.REC1 = [value.Input.res];
					break;

				case "TRANSACTION":
					newInput.acctNum = value.Input.acctNum;
					newInput.currency = value.Input.currency;
					newInput.startDate = value.Input.startDate;
					newInput.endDate = value.Input.endDate;
					break;

				case "BALANCE":
					newInput.acctNum = value.Input.acctNum;
					newInput.currency = value.Input.currency;
					break;

				case "CARD_USING":
					newInput.cardNum = value.Input.cardNum;
					newInput.cardType = value.Input.cardType;
					newInput.startDate = value.Input.startDate;
					newInput.endDate = value.Input.endDate;
					break;
					
				case "TRANSACTION_FIXED_DEPOSIT":
					newInput.acctNum = value.Input.acctNum;
					newInput.currency = value.Input.currency;
					newInput.startDate = value.Input.startDate;
					newInput.endDate = value.Input.endDate;
					break;
					
				case "BALANCE_FIXED_DEPOSIT":
					newInput.acctNum = value.Input.acctNum;
					newInput.currency = value.Input.currency;
					break;
					
					
			}

			newListInput.push(newInput);
		});

		var jexAjax = jexjs.createAjaxUtil("nxisas_fnsh_r001");
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set({
			"REC": newListInput,
			"NxisasCommon": common,
			"SAS_SessionID": sas_id,
			"NXISAS_GB_SEQ_NO": nxisasGbSeqNo
		});
		jexAjax.setting('async', true);
		setTimeout(function () {
				jexAjax.execute(function (cData) {

					let outputListResult = []
					$.each(cData.Input, function (key, value) {
						let output;

						if (cData.JSON_STR.ResultList) {
							output = cData.JSON_STR.ResultList[key].Output;
							output.ErrorMessage = output.ErrorMessage ? output.ErrorMessage : output.DetailMessage
						} else {
							output = {
								"DetailMessage": "LOGIN FAIL.",
								"ErrorCode": cData.JSON_STR.Result_cd,
								"ErrorMessage": cData.JSON_STR.Result_mg
							}
						}

						let outputResult = {
							"Module": value.Module,
							"Class": value.Class,
							"Job": value.Job,
							"Input": value,
							"Output": output,
							"SAS_SessionID": cData.JSON_STR.SAS_SessionID,
							"Common": cData.JSON_STR.Common
						}

						outputListResult.push(outputResult);
					})

					if (cData.Input[0].Job == "LOGIN") {
						const bankCd = _v2nxisas.orgObj[thread].bankCd
						_nxisas_auth[bankCd] = _nxisas_auth[bankCd] || {};
						_nxisas_auth[bankCd].SAS_SessionID = cData.JSON_STR.SAS_SessionID;
						_nxisas_auth[bankCd].Common = cData.JSON_STR.Common;
					}

					callBack(outputListResult, thread)
				})
			},
			200
		)
	},
	
	stopAllNxisas : function(callback) {
		CooconiSASNX.cancelAll(CooconiSASNX.OpenUid);
		callback();
	},
	
	isSuccess : function(code) {
		if ('00000000' == code
		|| '42110000' == code			// 거래내역을 찾을 수 없음
		|| '42120011' == code			// https://www.kosign.com.kh/redmine/issues/36034
		|| '42120111' == code			// Similar case as #36034
		) {
			return true;
		} else {
			return false;
		}
	},
	
	getAcctCustType : function(bankCd, gbSeqNo) {
		if (
			   ('00000000000000000041' == bankCd && '1' == gbSeqNo)	// ACLEDA Personal Banking
			|| ('00000000000000000058' == bankCd && '1' == gbSeqNo)	// PPCB Personal Banking
			|| ('00000000000000000053' == bankCd && '1' == gbSeqNo)	// Shinhan Khmer Personal Banking
		   ) {
			return 'P';
		} else {
			return 'C';
		}
	},
	
	/*#38021*/
	getModuleInfo: function(bankCd, seqno){
		var jexAjax = jexjs.createAjaxUtil("nxisas_getModuleInfo");
		var input = {};
		var dataObj = null;
		if ('VIETNAM_GDT' == bankCd) {
			input.API_ID = "NTS_NTS001_00001";
		} else {
			input.API_ID = "BNK_BNK001_"+bankCd;	
		}
		
		if ('0' != seqno) {
			input.API_ID += "_"+seqno;	
		}
		
		jexAjax.setting({ 'suffix': ".jct" });
		jexAjax.set(input);
		jexAjax.setting('async', false);
		jexAjax.execute(function (rData) {
			if (jexjs.isJexError(rData)) {
				top.tmsComm.destroyProgressBar();
				_v2common.app.showMessage(rData);
				return;
			}
			//console.log("getModuleInfo >> ",rData);
			dataObj = rData;
		});	
		return dataObj;			
	},

}