import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../context/AuthContext'
import { Building2, User, Eye, EyeOff, ArrowRight, ArrowLeft, Check } from 'lucide-react'

export default function Onboarding() {
  const [step, setStep] = useState(1) // 1: agency, 2: admin
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { onboarding } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors }, trigger } = useForm({
    defaultValues: {
      nombre_agencia: '',
      email_contacto: '',
      telefono: '',
      cuit: '',
      admin_nombre: '',
      admin_apellido: '',
      admin_email: '',
      admin_password: '',
    },
  })

  const nextStep = async () => {
    if (step === 1) {
      const valid = await trigger(['nombre_agencia', 'email_contacto', 'telefono', 'cuit'])
      if (!valid) return
    }
    setError('')
    setStep(step + 1)
  }

  const prevStep = () => {
    setError('')
    setStep(step - 1)
  }

  const onSubmit = async (data) => {
    setError('')
    setLoading(true)

    try {
      const result = await onboarding(data)

      if (result.success) {
        window.dataLayer?.push({
          event: 'sign_up',
          method: 'email',
          agency_name: data.nombre_agencia,
        })
        navigate('/')
      } else {
        setError(result.error || 'Error al registrar. Intenta de nuevo.')
      }
    } catch (err) {
      setError('Error de conexion. Verifica tu internet e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Registra tu Agencia</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Comenza con 14 dias de prueba gratis. Sin tarjeta de credito.
            </p>
          </div>

          {/* Progress steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step > s ? 'bg-green-500 text-white' :
                  step === s ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 2 && (
                  <div className={`w-12 h-0.5 ${step > s ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 1: Agency info */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Datos de la Agencia
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nombre de la agencia *
                  </label>
                  <input
                    {...register('nombre_agencia', {
                      required: 'El nombre es obligatorio',
                      minLength: { value: 2, message: 'Minimo 2 caracteres' },
                    })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    placeholder="Ej: Autos del Sur"
                  />
                  {errors.nombre_agencia && (
                    <p className="text-red-500 text-xs mt-1">{errors.nombre_agencia.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email de contacto *
                  </label>
                  <input
                    type="email"
                    {...register('email_contacto', {
                      required: 'El email es obligatorio',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalido' },
                    })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    placeholder="contacto@tuagencia.com"
                  />
                  {errors.email_contacto && (
                    <p className="text-red-500 text-xs mt-1">{errors.email_contacto.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Telefono
                    </label>
                    <input
                      {...register('telefono')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      CUIT
                    </label>
                    <input
                      {...register('cuit')}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                      placeholder="20-12345678-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Admin user */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Tu cuenta de administrador
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nombre *
                    </label>
                    <input
                      {...register('admin_nombre', {
                        required: 'El nombre es obligatorio',
                        minLength: { value: 2, message: 'Minimo 2 caracteres' },
                      })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                      placeholder="Juan"
                    />
                    {errors.admin_nombre && (
                      <p className="text-red-500 text-xs mt-1">{errors.admin_nombre.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Apellido *
                    </label>
                    <input
                      {...register('admin_apellido', {
                        required: 'El apellido es obligatorio',
                        minLength: { value: 2, message: 'Minimo 2 caracteres' },
                      })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                      placeholder="Perez"
                    />
                    {errors.admin_apellido && (
                      <p className="text-red-500 text-xs mt-1">{errors.admin_apellido.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email de acceso *
                  </label>
                  <input
                    type="email"
                    {...register('admin_email', {
                      required: 'El email es obligatorio',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email invalido' },
                    })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                  {errors.admin_email && (
                    <p className="text-red-500 text-xs mt-1">{errors.admin_email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Contrasena *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('admin_password', {
                        required: 'La contrasena es obligatoria',
                        minLength: { value: 12, message: 'Minimo 12 caracteres' },
                        validate: {
                          hasUpper: (v) => /[A-Z]/.test(v) || 'Debe incluir al menos una mayuscula',
                          hasDigit: (v) => /\d/.test(v) || 'Debe incluir al menos un numero',
                          hasSpecial: (v) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v) || 'Debe incluir un caracter especial',
                        },
                      })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all pr-12"
                      placeholder="Minimo 12 caracteres"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Min. 12 caracteres, una mayuscula, un numero, un caracter especial
                  </p>
                  {errors.admin_password && (
                    <p className="text-red-500 text-xs mt-1">{errors.admin_password.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Anterior
                </button>
              ) : (
                <div />
              )}

              {step < 2 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Registrando...
                    </>
                  ) : (
                    <>
                      Crear Agencia
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Ya tenes cuenta?{' '}
              <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-800 transition-colors">
                Iniciar sesion
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
