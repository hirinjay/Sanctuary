import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import { signIn, signUp, signOut, getSession, onAuthStateChange } from '../../lib/auth'
import { loadSaveSlots, loadSave, deleteSave } from '../../lib/persistence'
import { BOOKS } from '../../data/books'
import { hasSupabase } from '../../lib/supabase'

const pg = {
  background:'#040810', minHeight:'100vh', fontFamily:'Georgia,serif',
  color:'#c4a882', display:'flex', flexDirection:'column', alignItems:'center',
  justifyContent:'center', padding:'24px 16px',
}

function fmt(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = Date.now(), diff = now - d.getTime()
  if (diff < 60000)  return 'just now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
  return `${Math.floor(diff/86400000)}d ago`
}

export default function HomeScreen() {
  const {
    currentUser, saveSlots, setCurrentUser, setSaveSlots,
    loadSaveIntoStore, newGameInSlot, openBestiary,
  } = useGameStore()

  const [tab,        setTab]        = useState('signin')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [working,    setWorking]    = useState(false)
  const [err,        setErr]        = useState(null)
  const [notice,     setNotice]     = useState(null)
  const [checking,   setChecking]   = useState(true)
  const [loadingSlot,setLoadingSlot]= useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  // ── Auth init ────────────────────────────────────────────────────────
  useEffect(() => {
    getSession().then(async session => {
      if (session) {
        setCurrentUser(session.user)
        setSaveSlots(await loadSaveSlots(session.user.id))
      }
      setChecking(false)
    })
    const unsub = onAuthStateChange(async session => {
      if (session) {
        setCurrentUser(session.user)
        setSaveSlots(await loadSaveSlots(session.user.id))
      } else {
        setCurrentUser(null)
        setSaveSlots([])
      }
    })
    return unsub
  }, [])

  // ── Auth handlers ────────────────────────────────────────────────────
  async function handleAuth(e) {
    e.preventDefault()
    setErr(null); setNotice(null); setWorking(true)
    const fn = tab === 'signin' ? signIn : signUp
    const { error, data } = await fn(email, password)
    setWorking(false)
    if (error) { setErr(error.message); return }
    if (tab === 'signup' && !data?.session) {
      setNotice('Check your email to confirm your account.')
    }
  }

  async function handleSignOut() {
    await signOut()
    setCurrentUser(null)
    setSaveSlots([])
  }

  // ── Slot handlers ────────────────────────────────────────────────────
  async function handleLoad(slot) {
    setLoadingSlot(slot)
    const data = await loadSave(currentUser?.id ?? null, slot)
    setLoadingSlot(null)
    if (!data) return
    loadSaveIntoStore(data, slot)
  }

  async function handleDelete(slot) {
    await deleteSave(currentUser?.id ?? null, slot)
    setConfirmDel(null)
    setSaveSlots(await loadSaveSlots(currentUser?.id ?? null))
  }

  function handleNewGame(slot) { newGameInSlot(slot) }

  // ── Shared styles ────────────────────────────────────────────────────
  const input = {
    background:'#080c14', border:'1px solid #2a2a3a', borderRadius:5,
    padding:'9px 12px', color:'#c4a882', fontSize:12, width:'100%',
    outline:'none', boxSizing:'border-box',
  }
  const primaryBtn = (on = true) => ({
    background: on ? '#1a2a3a' : '#0b0f1c',
    border:`1px solid ${on ? '#4a6a8a' : '#222233'}`,
    borderRadius:5, padding:'9px 0', color: on ? '#8ab4d4' : '#4a4a5a',
    cursor: on ? 'pointer' : 'default', fontSize:12, width:'100%',
  })

  // ── Render ────────────────────────────────────────────────────────────
  if (checking) return (
    <div style={pg}>
      <div style={{ color:'#3a4a3a', fontSize:12 }}>Loading…</div>
    </div>
  )

  return (
    <div style={pg}>
      {/* Title */}
      <div style={{ textAlign:'center', marginBottom:36 }}>
        <div style={{ fontSize:52, marginBottom:8 }}>🏚</div>
        <h1 style={{ fontSize:28, color:'#e8d5b0', letterSpacing:6, margin:'0 0 4px', textTransform:'uppercase' }}>
          Sanctuary
        </h1>
        <p style={{ color:'#3a4a3a', fontSize:11, letterSpacing:3, margin:0 }}>
          A Necromancer's Burden
        </p>
      </div>

      {!currentUser ? (
        /* ── Auth form ── */
        <div style={{ width:'100%', maxWidth:340 }}>
          {!hasSupabase && (
            <div style={{ background:'#1a0a0a', border:'1px solid #4a2a2a', borderRadius:6,
              padding:'8px 12px', fontSize:11, color:'#7a4a4a', marginBottom:16, textAlign:'center' }}>
              Supabase env vars not set — saves will use localStorage only.
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', marginBottom:16, borderBottom:'1px solid #1a1a2a' }}>
            {['signin','signup'].map(t => (
              <button key={t} onClick={() => { setTab(t); setErr(null); setNotice(null) }} style={{
                flex:1, background:'none', border:'none',
                borderBottom:`2px solid ${tab===t?'#6a6aaa':'transparent'}`,
                padding:'8px 0', color:tab===t?'#c4a882':'#4a4a5a',
                cursor:'pointer', fontSize:12,
              }}>
                {t === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleAuth} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <input style={input} type="email" placeholder="Email"
              value={email} onChange={e => setEmail(e.target.value)} required />
            <input style={input} type="password" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)} required />
            {err    && <p style={{ color:'#8a3a3a', fontSize:11, margin:0 }}>{err}</p>}
            {notice && <p style={{ color:'#5a8a5a', fontSize:11, margin:0 }}>{notice}</p>}
            <button type="submit" disabled={working} style={primaryBtn(!working)}>
              {working ? '…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

      ) : (
        /* ── Save slots ── */
        <div style={{ width:'100%', maxWidth:480 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <span style={{ fontSize:11, color:'#3a4a3a' }}>{currentUser.email}</span>
            <button onClick={handleSignOut} style={{
              background:'none', border:'1px solid #2a2a2a', borderRadius:4,
              padding:'4px 10px', color:'#4a4a4a', cursor:'pointer', fontSize:10,
            }}>Sign out</button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(slot => {
              const save = saveSlots.find(s => s.slot === slot)
              const book = save?.book ?? BOOKS.find(b => b.id === save?.book_id)
              const isLoading = loadingSlot === slot

              return (
                <div key={slot} style={{
                  background:'#090e1a', border:'1px solid #1a1a2a', borderRadius:8,
                  padding:'14px 16px', display:'flex', alignItems:'center', gap:14,
                }}>
                  {/* Slot number */}
                  <div style={{ fontSize:11, color:'#2a3a3a', minWidth:16, textAlign:'center' }}>
                    {slot}
                  </div>

                  {save ? (
                    <>
                      {/* Save info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <span style={{ fontSize:16 }}>{book?.emoji ?? '📖'}</span>
                          <span style={{ fontSize:12, color:'#e8d5b0', fontWeight:'bold' }}>
                            {book?.name ?? 'Unknown'}
                          </span>
                          <span style={{ fontSize:10, color:'#5a8a5a' }}>
                            Lv{save.varek_level ?? 1}
                          </span>
                        </div>
                        <div style={{ fontSize:10, color:'#3a4a3a' }}>
                          {save.sanctuary_placed ? '⌂ Sanctuary placed' : '⏳ No sanctuary yet'}
                          {save.updated_at && <span style={{ marginLeft:8 }}>{fmt(save.updated_at)}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', gap:7, flexShrink:0 }}>
                        {confirmDel === slot ? (
                          <>
                            <button onClick={() => handleDelete(slot)} style={{
                              background:'#1a0808', border:'1px solid #6a2a2a', borderRadius:4,
                              padding:'5px 10px', color:'#8a4a4a', cursor:'pointer', fontSize:10,
                            }}>Confirm</button>
                            <button onClick={() => setConfirmDel(null)} style={{
                              background:'#0b0f1c', border:'1px solid #2a2a3a', borderRadius:4,
                              padding:'5px 10px', color:'#4a4a5a', cursor:'pointer', fontSize:10,
                            }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleLoad(slot)} disabled={isLoading} style={{
                              background:'#0a1a2a', border:'1px solid #3a5a7a', borderRadius:4,
                              padding:'6px 13px', color:isLoading?'#3a4a5a':'#6a9aba',
                              cursor:isLoading?'default':'pointer', fontSize:11,
                            }}>
                              {isLoading ? '…' : 'Continue'}
                            </button>
                            <button onClick={() => setConfirmDel(slot)} style={{
                              background:'none', border:'1px solid #2a2a2a', borderRadius:4,
                              padding:'6px 8px', color:'#3a3a4a', cursor:'pointer', fontSize:10,
                            }}>✕</button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:'#2a3a2a' }}>Empty</div>
                      </div>
                      <button onClick={() => handleNewGame(slot)} style={{
                        background:'#0a140a', border:'1px solid #2a4a2a', borderRadius:4,
                        padding:'6px 13px', color:'#4a7a4a', cursor:'pointer', fontSize:11,
                      }}>
                        New Game
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={() => openBestiary()} style={{
            display:'block', width:'100%', marginTop:16,
            background:'#0a0814', border:'1px solid #3a2a5a', borderRadius:6,
            padding:'11px 0', color:'#8a6aba', cursor:'pointer', fontSize:12, letterSpacing:1,
          }}>
            📖 Bestiary
          </button>
        </div>
      )}
    </div>
  )
}
