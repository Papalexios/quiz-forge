import React from 'react';
import { LightbulbIcon } from './LightbulbIcon';
import { QuizIcon, TrophyIcon, ListIcon } from './ToolIcons';
import { CheckIcon } from './CheckIcon';

const iconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  quiz: QuizIcon,
  trophy: TrophyIcon,
  list: ListIcon,
  checkmark: CheckIcon,
  idea: LightbulbIcon,
};

export const DynamicIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const sanitizedName = name ? name.toLowerCase() : 'idea';
    const IconComponent = iconMap[sanitizedName] || LightbulbIcon;
    return <IconComponent className={className} />;
};