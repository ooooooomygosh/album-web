import React from 'react';
import * as Hero from '@heroicons/react/24/outline';

// All interface glyphs use the official Heroicons outline SVGs (MIT).
const icon = (name) => function InterfaceIcon({ size = 20, strokeWidth = 1.7, style, ...props }) {
  const Component = Hero[name];
  return <Component aria-hidden="true" data-icon-library="heroicons" width={size} height={size} strokeWidth={strokeWidth} style={{ flexShrink: 0, ...style }} {...props}/>;
};
export const Album = icon('RectangleStackIcon'), ArrowUpRight = icon('ArrowUpRightIcon'), BookOpen = icon('BookOpenIcon'), Bot = icon('CpuChipIcon');
export const ChevronLeft = icon('ChevronLeftIcon'), ChevronRight = icon('ChevronRightIcon'), CirclePlus = icon('PlusCircleIcon'), Disc3 = icon('CircleStackIcon');
export const DoorOpen = icon('ArrowRightStartOnRectangleIcon'), Grid3X3 = icon('Squares2X2Icon'), Library = icon('BuildingLibraryIcon'), LockKeyhole = icon('LockClosedIcon');
export const MessageCircle = icon('ChatBubbleLeftEllipsisIcon'), Music2 = icon('MusicalNoteIcon'), Radio = icon('RadioIcon'), Plus = icon('PlusIcon');
export const Search = icon('MagnifyingGlassIcon'), Send = icon('PaperAirplaneIcon'), Share2 = icon('ShareIcon'), Sparkles = icon('SparklesIcon');
export const Star = icon('StarIcon'), Trash2 = icon('TrashIcon'), UserRound = icon('UserIcon'), Users = icon('UserGroupIcon'), Wand2 = icon('AdjustmentsHorizontalIcon');
export const Pause = icon('PauseIcon'), Play = icon('PlayIcon'), Shuffle = icon('ArrowsRightLeftIcon'), X = icon('XMarkIcon');
export const Settings = icon('Cog6ToothIcon'), Minus = icon('MinusIcon'), Maximize = icon('StopIcon'), External = icon('ArrowTopRightOnSquareIcon');
export const Download = icon('ArrowDownTrayIcon'), Check = icon('CheckIcon'), Up = icon('ChevronUpIcon'), Down = icon('ChevronDownIcon');
export const Info = icon('InformationCircleIcon'), ErrorIcon = icon('ExclamationCircleIcon'), Loading = icon('ArrowPathIcon');
