'use strict';
const form=document.getElementById('login-form'),button=document.getElementById('login-submit'),status=document.getElementById('login-status');
form.addEventListener('submit',async event=>{
  event.preventDefault();button.disabled=true;status.textContent='正在验证…';
  try{
    const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:form.elements.key.value})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'登录失败。');
    form.reset();location.replace('/admin');
  }catch(error){status.textContent=error.message;status.className='error';}
  finally{button.disabled=false;}
});
