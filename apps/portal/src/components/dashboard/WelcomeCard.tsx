import Link from 'next/link';
import { Card, CardContent, Button } from '@crm-eco/ui';
import { Heart, ArrowRight, HelpCircle, FileText } from 'lucide-react';

interface WelcomeCardProps {
  firstName: string;
  hasActiveMembership: boolean;
  hasInProgressEnrollment: boolean;
  inProgressEnrollmentId?: string;
}

export function WelcomeCard({
  firstName,
  hasActiveMembership,
  hasInProgressEnrollment,
  inProgressEnrollmentId,
}: WelcomeCardProps) {
  const getSubtext = () => {
    if (hasActiveMembership) {
      return "Here's a quick view of your membership and recent activity.";
    }
    if (hasInProgressEnrollment) {
      return "You have an enrollment in progress. Pick up where you left off.";
    }
    return "You don't have an active membership yet. You can start an enrollment below.";
  };

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-blue-700 border-0 shadow-lg">
      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="text-white">
            <h1 className="text-2xl font-bold mb-2">Hi, {firstName}</h1>
            <p className="text-blue-100 text-sm md:text-base">
              {getSubtext()}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {hasInProgressEnrollment ? (
              <Link href={inProgressEnrollmentId ? `/enroll?resume=${inProgressEnrollmentId}` : '/enroll'}>
                <Button 
                  size="lg" 
                  className="bg-white text-blue-700 hover:bg-blue-50 gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Resume Enrollment
                </Button>
              </Link>
            ) : !hasActiveMembership ? (
              <Link href="/enroll">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-700 hover:bg-blue-50 gap-2"
                >
                  <Heart className="w-4 h-4" />
                  Start Enrollment
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : null}

            <Link href="/support">
              <Button 
                variant="outline" 
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                Contact Support
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

