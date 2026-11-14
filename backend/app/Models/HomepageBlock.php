<?php

namespace App\Models;

use Database\Factories\HomepageBlockFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['type', 'title', 'position', 'is_active', 'config'])]
class HomepageBlock extends Model
{
    /** @use HasFactory<HomepageBlockFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_active' => 'boolean',
            'config' => 'array',
        ];
    }
}
