import { useState, useEffect } from 'react'
import { tauriInvoke } from '../lib/tauri'
import { Clock, Trash2, Calendar, Repeat, Timer } from 'lucide-react'

interface ScheduledTask {
  id: string
  name: string
  macro_path: string
  schedule: {
    type: 'once' | 'daily' | 'interval'
    at_hour?: number
    at_minute?: number
    every_secs?: number
  }
  enabled: boolean
  last_run?: string
}

export function SchedulerPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)

  const [newTask, setNewTask] = useState({
    name: '',
    path: '',
    type: 'interval' as 'once' | 'daily' | 'interval',
    hour: 0,
    minute: 0,
    interval: 60
  })

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      const data: ScheduledTask[] = await tauriInvoke('get_scheduled_tasks')
      setTasks(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTask = async () => {
    if (!newTask.name || !newTask.path) return

    const task: any = {
      id: Math.random().toString(36).substr(2, 9),
      name: newTask.name,
      macro_path: newTask.path,
      enabled: true,
      schedule: {
        type: newTask.type,
        ...(newTask.type === 'interval' ? { every_secs: newTask.interval } : { at_hour: newTask.hour, at_minute: newTask.minute })
      }
    }

    try {
      await tauriInvoke('add_scheduled_task', { task })
      setNewTask({ ...newTask, name: '', path: '' })
      fetchTasks()
    } catch (err) {
      console.error(err)
    }
  }

  const removeTask = async (id: string) => {
    try {
      await tauriInvoke('remove_scheduled_task', { id })
      fetchTasks()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.1)]">
            <Clock size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-text-main">Automation Scheduler</h2>
        </div>
        <p className="text-text-dim max-w-2xl font-medium tracking-tight">
          Precision time-based orchestration. Configure daily routines, one-time triggers, or interval-based loops that persist in the daemon service.
        </p>
      </header>

      {/* Manual Task Injection */}
      <section className="bg-surface-light border-2 border-surface-lighter p-8 rounded-3xl shadow-xl space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 -rotate-12 translate-x-10 -translate-y-10" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Operation Name</label>
            <input
              type="text"
              placeholder="e.g. Server Cleanup"
              value={newTask.name}
              onChange={e => setNewTask(prev => ({ ...prev, name: e.target.value }))}
              className="w-full bg-surface border border-surface-lighter rounded-2xl py-4 px-6 text-sm font-bold placeholder:text-text-dim/30 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Resource Path</label>
            <input
              type="text"
              placeholder="C:\Automations\Cleanup.mpr"
              value={newTask.path}
              onChange={e => setNewTask(prev => ({ ...prev, path: e.target.value }))}
              className="w-full bg-surface border border-surface-lighter rounded-2xl py-4 px-6 text-sm font-bold placeholder:text-text-dim/30 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6 relative z-10 pt-4 border-t border-surface-lighter/50">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Trigger Type</label>
            <div className="flex bg-surface p-1.5 rounded-2xl border border-surface-lighter gap-1">
              {(['interval', 'daily', 'once'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNewTask(prev => ({ ...prev, type: t }))}
                  className={`btn-brutal px-4 py-2 text-[10px] ${newTask.type === t ? 'bg-primary text-white shadow-lg' : 'opacity-60 text-text-dim hover:opacity-100 hover:text-text-main'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {newTask.type === 'interval' ? (
            <div className="space-y-2 flex-1 min-w-[150px]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Every (Seconds)</label>
              <div className="flex items-center gap-3">
                <Timer className="text-text-dim" size={18} />
                <input
                  type="number"
                  value={newTask.interval}
                  onChange={e => setNewTask(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                  className="bg-surface border border-surface-lighter rounded-2xl py-3 px-6 text-sm font-bold w-full focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary px-1">Target Time (HH:MM)</label>
              <div className="flex items-center gap-3">
                <Clock className="text-text-dim" size={18} />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0" max="23"
                    value={newTask.hour}
                    onChange={e => setNewTask(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                    className="bg-surface border border-surface-lighter rounded-xl py-3 px-4 text-sm font-bold w-16 text-center focus:border-primary"
                  />
                  <span className="font-bold text-text-dim">:</span>
                  <input
                    type="number"
                    min="0" max="59"
                    value={newTask.minute}
                    onChange={e => setNewTask(prev => ({ ...prev, minute: parseInt(e.target.value) }))}
                    className="bg-surface border border-surface-lighter rounded-xl py-3 px-4 text-sm font-bold w-16 text-center focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleAddTask}
            disabled={!newTask.name || !newTask.path}
            className="btn-brutal btn-primary h-[50px] px-8 text-xs ml-auto"
          >
            Authorize Schedule
          </button>
        </div>
      </section>

      {/* Task List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-dim">Active Registries</h3>
          <div className="text-[10px] font-bold text-text-dim/40 uppercase bg-surface-lighter px-3 py-1 rounded-full">Automated Engine Online</div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center opacity-30">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-32 border-2 border-dashed border-surface-lighter rounded-3xl flex flex-col items-center justify-center text-text-dim/40 gap-4">
            <Calendar size={48} strokeWidth={1} />
            <span className="text-xs font-bold uppercase tracking-widest">No scheduled protocols found</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tasks.map((task) => (
              <div key={task.id} className="bg-surface border border-surface-lighter p-6 rounded-3xl flex items-center gap-8 hover:border-primary/50 transition-colors group relative overflow-hidden">
                {/* Progress indicator or dummy status */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors" />

                <div className="w-14 h-14 bg-surface-light rounded-2xl flex items-center justify-center text-primary shadow-inner group-hover:scale-110 transition-transform">
                  {task.schedule.type === 'interval' ? <Timer size={24} /> : task.schedule.type === 'daily' ? <Repeat size={24} /> : <Calendar size={24} />}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black uppercase tracking-widest text-text-main line-clamp-1">{task.name}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                      {task.schedule.type === 'interval' ? `Every ${task.schedule.every_secs}s` : `${task.schedule.at_hour}:${(task.schedule.at_minute ?? 0).toString().padStart(2, '0')}`}
                    </span>
                    <span className="text-[10px] font-black text-text-dim uppercase tracking-wider truncate max-w-[200px]">{task.macro_path}</span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-[9px] font-black uppercase tracking-widest text-text-dim/60">Last Activation</div>
                  <div className="text-[10px] font-bold text-text-main">{task.last_run ? new Date(task.last_run).toLocaleTimeString() : 'PENDING'}</div>
                </div>

                <div className="flex items-center gap-2 border-l border-surface-lighter pl-6">
                  <button
                    onClick={() => removeTask(task.id)}
                    className="btn-brutal p-3 text-text-dim hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
