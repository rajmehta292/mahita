import { redirect } from 'next/navigation'

export default function DataDoctorPage() {
    redirect('/admin?tab=data-command')
}
