import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, ChevronDown, ExternalLink, LoaderCircle, MessageCircle, RotateCcw, Send, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';
import { buildLocalCustomerServiceResult, customerServiceQuickQuestions, rankCustomerServiceContent } from './customerService.js';
import './customer-service.css';

const copy = (language, zh, en) => language === 'zh' ? zh : en;
const field = (item, key, language) => language === 'en' && item?.[`${key}En`] ? item[`${key}En`] : item?.[key] || '';

function welcomeMessage(language) {
  return {
    id: 'welcome',
    role: 'assistant',
    answer: copy(language, '您好，我是 CCT AI 智能客服。您可以直接问集团业务、AI 解决方案或合作方式，我会依据官网已发布资料回答。', 'Hello, I am CCT AI customer service. Ask about the group, AI solutions or ways to collaborate, and I will answer from published website materials.'),
  };
}

export default function CustomerService({ language = 'zh', content = [], live = false }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState([]);
  const launcher = useRef(null);
  const input = useRef(null);
  const transcript = useRef(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    if (window.matchMedia('(max-width: 640px)').matches) document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => input.current?.focus(), 80);
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        window.setTimeout(() => launcher.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => launcher.current?.focus(), 0);
  };

  const clear = () => {
    setMessages([]);
    setQuestion('');
    input.current?.focus();
  };

  const recentContext = () => messages.filter(message => message.role === 'user').slice(-3).map(message => message.answer).join('\n').slice(0, 800);

  const localAnswer = (text, context = '') => buildLocalCustomerServiceResult({
    question: text,
    language,
    sources: rankCustomerServiceContent(content, `${context}\n${text}`),
  });

  const send = async rawQuestion => {
    const text = String(rawQuestion ?? question).trim();
    if (text.length < 2 || pending) return;
    const userMessage = { id: `user-${nextId.current++}`, role: 'user', answer: text };
    setMessages(current => [...current, userMessage]);
    setQuestion('');
    setPending(true);
    const context = recentContext();
    let result;
    try {
      if (!live) throw new Error('local-mode');
      const response = await fetch('/api/public/ai/customer-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, context, language }),
      });
      if (!response.ok) throw new Error('customer-service-unavailable');
      result = (await response.json()).result;
    } catch {
      result = localAnswer(text, context);
      if (live) result.serviceNotice = copy(language, '在线回答暂时不可用，已切换为官网资料检索。', 'Live answers are temporarily unavailable. Published-content search is active.');
    }
    setMessages(current => [...current, { id: `assistant-${nextId.current++}`, role: 'assistant', ...result }]);
    setPending(false);
  };

  const renderedMessages = [welcomeMessage(language), ...messages];
  const questions = customerServiceQuickQuestions[language] || customerServiceQuickQuestions.zh;

  return <div className={`cct-customer-service${open ? ' is-open' : ''}`}>
    {open && <section className="cct-cs-panel" role="dialog" aria-modal="false" aria-labelledby="cct-cs-title">
      <header className="cct-cs-header">
        <div className="cct-cs-avatar" aria-hidden="true"><Bot size={22}/><span/></div>
        <div><h2 id="cct-cs-title">{copy(language, 'CCT AI 智能客服', 'CCT AI customer service')}</h2><p><span/>{copy(language, '依据官网资料为您解答', 'Answers grounded in CCT website content')}</p></div>
        <div className="cct-cs-header-actions">
          <button type="button" onClick={clear} aria-label={copy(language, '清空对话', 'Clear conversation')} title={copy(language, '清空对话', 'Clear conversation')}><RotateCcw size={17}/></button>
          <button type="button" onClick={close} aria-label={copy(language, '关闭智能客服', 'Close customer service')}><X size={19}/></button>
        </div>
      </header>

      <div className="cct-cs-transcript" ref={transcript} aria-live="polite" aria-busy={pending}>
        {renderedMessages.map(message => <article className={`cct-cs-message is-${message.role}`} key={message.id}>
          <div className="cct-cs-message-icon" aria-hidden="true">{message.role === 'assistant' ? <Sparkles size={15}/> : <UserRound size={15}/>}</div>
          <div className="cct-cs-message-body">
            <p className="cct-cs-answer">{message.answer}</p>
            {message.serviceNotice && <p className="cct-cs-notice">{message.serviceNotice}</p>}
            {message.sources?.length > 0 && <div className="cct-cs-sources">
              <span>{copy(language, '相关官网资料', 'Related website records')}</span>
              {message.sources.slice(0, 3).map(source => <Link key={source.id || source.slug} to={`/content/${encodeURIComponent(source.slug)}`} onClick={close}>{field(source, 'title', language)}<ExternalLink size={12}/></Link>)}
            </div>}
            {message.nextQuestions?.length > 0 && <div className="cct-cs-followups">{message.nextQuestions.slice(0, 2).map(item => <button key={item} type="button" onClick={() => send(item)}>{item}<ArrowRight size={12}/></button>)}</div>}
            {message.disclaimer && <small className="cct-cs-disclaimer"><ShieldCheck size={12}/>{message.disclaimer}</small>}
          </div>
        </article>)}
        {pending && <article className="cct-cs-message is-assistant is-loading" role="status"><div className="cct-cs-message-icon"><Sparkles size={15}/></div><div className="cct-cs-typing"><i/><i/><i/><span className="site-sr-only">{copy(language, '正在查找相关资料', 'Finding relevant information')}</span></div></article>}
      </div>

      {!messages.length && <div className="cct-cs-quick" aria-label={copy(language, '常见问题', 'Common questions')}>
        <span>{copy(language, '您可以这样问', 'Try asking')}</span>
        <div>{questions.map(item => <button type="button" key={item} onClick={() => send(item)}>{item}<ChevronDown size={13}/></button>)}</div>
      </div>}

      <footer className="cct-cs-composer">
        <form onSubmit={event => { event.preventDefault(); send(); }}>
          <label className="site-sr-only" htmlFor="cct-cs-question">{copy(language, '输入您的问题', 'Enter your question')}</label>
          <textarea id="cct-cs-question" ref={input} rows="1" maxLength="400" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={copy(language, '请输入业务或合作问题…', 'Ask about services or collaboration…')} />
          <button type="submit" disabled={pending || question.trim().length < 2} aria-label={copy(language, '发送问题', 'Send question')}>{pending ? <LoaderCircle className="site-spin" size={18}/> : <Send size={18}/>}</button>
        </form>
        <div className="cct-cs-composer-bottom"><span>{copy(language, '请勿发送密码或敏感个人信息', 'Do not send passwords or sensitive personal data')}</span><Link to="/contact" onClick={close}>{copy(language, '提交合作需求', 'Submit an enquiry')}<ArrowRight size={12}/></Link></div>
      </footer>
    </section>}

    <button ref={launcher} type="button" className="cct-cs-launcher" aria-label={copy(language, open ? '关闭 AI 智能客服' : '打开 AI 智能客服', open ? 'Close AI customer service' : 'Open AI customer service')} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="cct-cs-launcher-icon">{open ? <X size={22}/> : <MessageCircle size={23}/>}</span>
      {!open && <span className="cct-cs-launcher-copy"><strong>{copy(language, 'AI 智能客服', 'AI customer service')}</strong><small>{copy(language, '有问题，直接问', 'Ask us anything')}</small></span>}
    </button>
  </div>;
}
