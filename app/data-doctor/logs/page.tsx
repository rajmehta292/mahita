import { redirect } from 'next/navigation'

export default function DataDoctorLogsRedirectPage() {
    redirect('/admin?tab=data-command')
}
